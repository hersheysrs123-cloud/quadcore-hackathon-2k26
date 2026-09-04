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
37. [Print View Note Title & Icon Dynamic Header Positioning](#37-print-view-note-title--icon-dynamic-header-positioning)
38. [Note Controls Header Stacking & Clean Horizontal Alignment](#38-note-controls-header-stacking--clean-horizontal-alignment)
39. [Intelligent Note Reformatting Header Positioning & Responsive Controls](#39-intelligent-note-reformatting-header-positioning--responsive-controls)
40. [Long-Note Semantic Chunking, Full Document Breadth & Content Fidelity](#40-long-note-semantic-chunking-full-document-breadth--content-fidelity)
41. [Jumbled LaTeX Pathway Delimiter Healing & Asterisk Subheading Normalization](#41-jumbled-latex-pathway-delimiter-healing--asterisk-subheading-normalization)
42. [Rich Inline Markdown & KaTeX Rendering Across Blocks and Interactive Table Cells](#42-rich-inline-markdown--katex-rendering-across-blocks-and-interactive-table-cells)
43. [Note Saving, Block Pasting & Space Switching Persistence Overhaul](#43-note-saving-block-pasting--space-switching-persistence-overhaul)
44. [Marquee / Lasso Multi-Block Selection & Smooth Edge Auto-Scrolling Engine](#44-marquee--lasso-multi-block-selection--smooth-edge-auto-scrolling-engine)
45. [LaTeX MathBlock Dynamic Readability Floor, Visibility Check & Horizontal Scroll Wheel Panning](#45-latex-mathblock-dynamic-readability-floor-visibility-check--horizontal-scroll-wheel-panning)
46. [Sidebar Note Drag-and-Drop Reordering Engine & IndexedDB Order Synchronization](#46-sidebar-note-drag-and-drop-reordering-engine--indexeddb-order-synchronization)
47. [Right-Click Context Menu Support for Editor Blocks](#47-right-click-context-menu-support-for-editor-blocks)
48. [Persistent Side-by-Side AI Study Sidebar & Note Visibility Overhaul](#48-persistent-side-by-side-ai-study-sidebar--note-visibility-overhaul)
49. [Quiz Session Persistence, Race-Condition Locking & Generation De-duplication](#49-quiz-session-persistence-race-condition-locking--generation-de-duplication)
50. [Dedicated Quizzes Studio Tab with Custom AI Generation, Local Storage & Mastery Integration](#50-dedicated-quizzes-studio-tab-with-custom-ai-generation-local-storage--mastery-integration)
51. [Gemini OpenAPI Schema Validation & Overly Broad API Key Error Masking Fix](#51-gemini-openapi-schema-validation--overly-broad-api-key-error-masking-fix)
52. [Heading Extractor Overhaul & Multi-Heading Checkbox Selection System](#52-heading-extractor-overhaul--multi-heading-checkbox-selection-system)
53. [Worked Through Example Object Deserialization & Structured Step Rendering](#53-worked-through-example-object-deserialization--structured-step-rendering)
54. [Max Output Token Capacity Increase & Quiz Stepper Range Expansion](#54-max-output-token-capacity-increase--quiz-stepper-range-expansion)
55. [Gemini 3.5 Flash-Lite 32K Output Token Expansion & Mega-Quiz Capacity Upgrade](#55-gemini-35-flash-lite-32k-output-token-expansion--mega-quiz-capacity-upgrade)
56. [Custom Accent-Gold Gradient Range Sliders & Direct Input Integration](#56-custom-accent-gold-gradient-range-sliders--direct-input-integration)
57. [Quizzes Tab Subsystem Comprehensive Bug Audit & End-to-End Resolution](#57-quizzes-tab-subsystem-comprehensive-bug-audit--end-to-end-resolution)
58. [Next.js Production Build Artifact Collision Purge & Hot-Reload Stabilization](#58-nextjs-production-build-artifact-collision-purge--hot-reload-stabilization)
59. [Quiz Me Generator Default Question Expansion (5 MCQs + 3 Short Answers)](#59-quiz-me-generator-default-question-expansion-5-mcqs--3-short-answers)
60. [Academic Syllabus & Curriculum Boundary Feature (Settings > General)](#60-academic-syllabus--curriculum-boundary-feature-settings--general)
61. [Sidebar Note Drag-and-Drop Reordering Engine & Order Preservation Overhaul](#61-sidebar-note-drag-and-drop-reordering-engine--order-preservation-overhaul)
62. [UI Decluttering: Dual-Level Space/Global Navigation, Ghost Action Icons & Progressive Disclosure Headers](#62-ui-decluttering-dual-level-spaceglobal-navigation-ghost-action-icons--progressive-disclosure-headers)
63. [AI Tutor Rich Markdown, Code Syntax Highlighting & KaTeX Integration](#63-ai-tutor-rich-markdown-code-syntax-highlighting--katex-integration)
64. [Photorealistic 3D Human Respiratory Mechanics & Model Alignment Overhaul](#64-photorealistic-3d-human-respiratory-mechanics--model-alignment-overhaul)

---

## 62. UI Decluttering: Dual-Level Space/Global Navigation, Ghost Action Icons & Progressive Disclosure Headers

### Problem Statement
1. **Top Header Overcrowding**:
   - The top navigation bar previously held 6 wide tab buttons (`Notes`, `Calendar`, `Web Saver`, `3D Orbit`, `Quizzes`, `Mastery`) alongside breadcrumbs, study actions, and focus toggles.
   - Global utilities (3D Simulations, Calendar & Timers, Web Saver) were mixed with space-specific views (Notes, Quizzes, Mastery), creating conceptual ambiguity and heavy visual clutter.
2. **Sidebar Notes Visual Clutter**:
   - Every note item in the sidebar permanently displayed a drag handle grip (`⠿`) and a 3-dots note menu (`...`), cluttering the list even when just reading or selecting notes.
3. **Note Editor Header Clutter**:
   - In `BlockNoteEditor.jsx`, creating a new note permanently displayed static `Add Cover Banner`, `Add Icon`, and `Reformat Note` buttons across the top and above the title, preventing a clean, distraction-free document canvas.

### Resolution & Architectural Enhancements
1. **Dual-Level Navigation Architecture (`Workspace.jsx` & `Sidebar.jsx`)**:
   - **Top Header**: Streamlined strictly to the 3 space-filtered study tabs: 📝 **Notes**, 🎯 **Quizzes Studio**, and 📊 **Mastery Dashboard** (with active gap count badge). Clean breadcrumb indicating active space and note title or active global tool view.
   - **Sidebar Global Tools**: Added a dedicated "Global Tools" section in `Sidebar.jsx` hosting system-wide tools independent of space selection: 🌌 **3D Simulations**, 📅 **Calendar & Timers** (integrating `GlobalTimerHUD`), and 🔖 **Web Saver & Bookmarks**.
2. **Ghost Action Icons on Sidebar Notes (`Sidebar.jsx`)**:
   - Converted the drag handle (`GripVertical` `⠿`) and 3-dots menu (`NoteMenu` `...`) into ghost action icons (`opacity-0`), which smoothly transition into view on row hover (`group-hover:opacity-100 focus-within:opacity-100`) without layout shift.
   - Preserved gold ⭐ badges for favorite notes.
3. **Progressive Disclosure on Covers & Headers (`BlockNoteEditor.jsx`)**:
   - Notes without covers or icons now render as a pure, clean document canvas.
   - Hovering over the top title area (`group/header`) progressively reveals action pills: `[ 😀 Add Icon ]`, `[ 🖼️ Add Cover ]`, and `[ ✨ Reformat ]`.
   - When a banner is active, it spans the full top width with `Change Cover` and `Reformat` pills in the corner. Clicking large note icons opens the emoji selector.
4. **Verification**:
   - Full automated test suite passing (119 unit & integration tests across 40 suites).
   - Production build compiled successfully (`npm run build`), production server live on port 3000 (`npm run start`).

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

---

## 43. Note Saving, Block Pasting & Space Switching Persistence Overhaul

### Root Causes & Problem Statements
1. **`Workspace.jsx` `handleSaveNote` Fallback Defect**:
   When `handleSaveNote` was triggered without an explicit `blocks` payload (e.g. from pressing `Ctrl+S`, using `NoteMenu` save, or updating partial attributes like `isFavorite`), it fell back to `activeNoteObj?.blocks` from `notesBySpace`. Because `notesBySpace` was never synchronized during active block editing/pasting, `activeNoteObj.blocks` remained the stale empty initial array `[{ id: '...', type: 'text', content: '' }]`. As a result, saving or switching spaces overwrote the note with empty blocks in IndexedDB, destroying all pasted blocks and typed content.
2. **`BlockNoteEditor.jsx` Missing Auto-Save on Block Edits**:
   `BlockNoteEditor.jsx` only had debounced auto-saving wired to `title` changes (`handleTitleChange`), whereas all block-level content mutations (`handleChange`, `handleSmartPaste`, `handleAddAfter`, `handleDeleteBlock`, `handleChangeType`, table cell edits, and math updates) mutated local React state and called `onBlocksChange`, but never scheduled a debounced save to persist to IndexedDB.
3. **Missing Note & Space Identifiers on Save Calls**:
   `BlockNoteEditor` was mounted without explicit `noteId` and `spaceId` props, and its save calls omitted target IDs. When notes were saved asynchronously or during unmount, this caused race conditions where saves could target the wrong note or fail to resolve the proper space.
4. **Unmount State Loss on Space & Note Switching**:
   When a user switched spaces or selected another note, `BlockNoteEditor` unmounted immediately. Without an unmount flush mechanism carrying dirty state, recent keystrokes and pasted blocks were lost before IndexedDB was updated.
5. **Space Switching State Desynchronization**:
   Selecting a space in `Sidebar.jsx` switched `activeSpace` and `activeNoteId`, but failed to synchronize the `editorBlocks` state in `Workspace.jsx`.

### Resolution & Architectural Enhancements
1. **Priority Block Resolution in `handleSaveNote` (`components/Workspace.jsx`)**:
   * Maintained a live `editorBlocksRef = useRef(editorBlocks)` kept in sync with editor changes.
   * Updated `handleSaveNote` to prioritize `editorBlocksRef.current` whenever saving an active note without explicit blocks, guaranteeing pasted or typed blocks are never overwritten by stale initial arrays.
2. **Complete Auto-Save & Debounce Engine (`components/BlockNoteEditor.jsx`)**:
   * Implemented `performSave(overrides)` that always bundles complete note state (`id`, `spaceId`, `title`, `blocks`, `banner`, `isFavorite`, `emoji`).
   * Implemented `triggerDebouncedSave(overrides)` (400ms debounce) and `flushSave()`.
   * Connected debounced auto-save across all block editing handlers: `handleChange`, `handleSmartPaste`, `handleAddAfter`, `handleDeleteBlock`, `handleDuplicateBlock`, `handleMoveBlock`, `handleChangeType`, `handleKeyDown`, Banner picker, and Emoji picker.
3. **Unmount Save Flush Guard (`components/BlockNoteEditor.jsx`)**:
   * Added an unmount cleanup effect that immediately flushes any pending `isDirtyRef` changes with explicit `noteIdRef.current` and `spaceIdRef.current`, ensuring zero data loss on space switching or navigation.
4. **Explicit `noteId` & `spaceId` Threading (`components/Workspace.jsx`)**:
   * Passed explicit `noteId={activeNoteObj?.id || ""}` and `spaceId={activeNoteObj?.spaceId || activeNoteObj?.space || activeSpace}` into `<BlockNoteEditor>`.
5. **Space Switching & Note Creation Synchronization (`components/Workspace.jsx`)**:
   * In `onSelectSpace` and `handleSelectNote`, immediately synchronized `setEditorBlocks` with the target note's blocks.
   * In `handleCreateNote`, immediately initialized `setEditorBlocks(newNote.blocks)` and persisted the new note to IndexedDB with `saveNote(newNote)`.
6. **Automated Verification**:
   * Added unit test suite `tests/unit/note-persistence-flow.test.mjs` verifying note creation in newly created spaces, block pasting, space switching round-trips, and partial save resilience.

---

## 44. Marquee / Lasso Multi-Block Selection & Smooth Edge Auto-Scrolling Engine

### Root Causes & Problem Statements
1. **Fixed Coordinate Attachment & Scrolling Blindness**: The lasso selection overlay was previously positioned with viewport `fixed` CSS coordinates and calculated intersections purely against raw `e.clientX` / `e.clientY`. When notes exceeded a single screen height, dragging downwards failed to auto-scroll the page, preventing users from selecting blocks below (or above) the visible viewport. If the user scrolled with the trackpad during selection, the fixed marquee detached from the document content.
2. **Severe Layout Thrashing & Mouse Move Lag**: On every single raw `mousemove` event (firing 120+ times per second), `handleEditorMouseMove` executed `document.querySelector` across all blocks, triggered `el.getBoundingClientRect()`, and called `setSelectedBlockIds(newSelected)` and `setMarqueeBox(...)` indiscriminately. This forced continuous browser layout reflows and full component re-renders per pixel of movement.
3. **Costly CSS Filter & Animation Overhead**: The overlay used `backdrop-blur-[1px]` and `animate-pulse`, requiring expensive GPU buffer sampling and compositing on every animation frame over KaTeX math formulas, code blocks, and canvas graphics.

### Resolution & Architectural Enhancements
1. **Document-Anchored Absolute Coordinate Space (`BlockNoteEditor.jsx`)**:
   * Positioned the marquee box with `absolute` coordinates inside `editorContainerRef`, anchoring it directly to document content so it scrolls naturally with the note.
2. **Smooth 60/120fps `requestAnimationFrame` Engine (`updateMarqueeFrame`)**:
   * Consolidated mousemove tracking into an animation frame loop (`updateMarqueeFrame`), updating coordinates and intersection calculations in sync with the display refresh rate.
3. **Continuous Edge Proximity Auto-Scrolling**:
   * Integrated an auto-scroll engine that detects when the cursor approaches within 80px of the scroll container's top or bottom edges, progressively scrolling the container (up to 35px/frame) and recalculating block intersections dynamically.
4. **Selection Set Equality Caching**:
   * Added equality checks comparing newly intersected block IDs with `selectedBlockIdsRef.current` to prevent unnecessary React state updates and re-renders when the set of selected blocks has not changed.
5. **Lightweight, Crisp Visual Layer**:
   * Replaced heavy `backdrop-blur` and `animate-pulse` with a crisp `border-duck-400/80 bg-duck-500/15` visual layer.
6. **Automated Verification**:
   * Added unit tests in `tests/unit/note-persistence-flow.test.mjs` verifying 2D box intersection geometry and edge proximity auto-scroll velocity curves.

---

## 45. LaTeX MathBlock Dynamic Readability Floor, Visibility Check & Horizontal Scroll Wheel Panning

### Root Causes & Problem Statements
1. **Unbounded Microscopic Font Shrinking**: Previously, `MathBlock` scaled formulas down toward an arbitrary scale factor of `0.35`. Complex multiline equations, matrices, or long physics derivations shrank into microscopic, unreadable text rather than preserving an accessible font size.
2. **Viewport Clipping & Missing Scroll Container**: The formula container used `overflow-hidden`. Any equation wider than the viewport container was clipped, with no horizontal scroll container or scrollbar available for users to read the full expression.
3. **Missing Mouse Wheel Horizontal Panning**: On desktop mice without horizontal tilt wheels or trackpads, users could not scroll sideways through long equations using the standard vertical scroll wheel.

### Resolution & Architectural Enhancements
1. **Intelligent Visibility Check & Minimum Readable Scale Floor (`MIN_READABLE_SCALE = 0.75`)**:
   * If a formula fits within the container (or within a comfortable scale range of `[0.75, 1.0]`), it scales smoothly to fit with zero scrollbars.
   * If the equation is too long to fit at `0.75` scale, the editor clamps font size to the `0.75` readability floor and dynamically activates horizontal scrolling (`isOverflowing = true`).
2. **Automatic Horizontal Scroll Container & Subtle Indicator**:
   * When overflowing, the viewport enables `overflow-x-auto overflow-y-hidden`, aligns the formula at the start (`justify-start`), and applies a slim custom scrollbar alongside a subtle `↔ Scroll` hint badge.
3. **Vertical Mouse Wheel to Horizontal Panning Listener**:
   * Attached an active `wheel` event listener to the equation viewport translating `e.deltaY` into smooth horizontal scrolling (`scrollLeft += e.deltaY * 0.85`), with intelligent boundary passthrough when reaching start/end edges.
4. **Automated Verification**:
   * Added unit tests in `tests/unit/note-persistence-flow.test.mjs` validating short equation 100% scaling, medium equation dynamic downscaling, long equation floor clamping, and wheel delta horizontal translation.

---

## 46. Sidebar Note Drag-and-Drop Reordering Engine & IndexedDB Order Synchronization

### Root Causes & Problem Statements
1. **Static Note Ordering**: Notes in the sidebar were strictly rendered in the order they were initially queried or created. There was no user-facing way to reorder notes or organize topics by priority.
2. **Missing Order Index & Persistence**: The database schema lacked an explicit `order` property on notes, meaning custom sort positions were never persisted between browser restarts or workspace switches.

### Resolution & Architectural Enhancements
1. **Interactive Drag-and-Drop Grips (`components/Sidebar.jsx`)**:
   * Added a `GripVertical` (`⠿`) drag handle on hover for every note row in the sidebar list.
   * Integrated HTML5 drag events (`onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`, `onDragEnd`) with `dragOverInfo` state tracking cursor position relative to the target item center.
2. **Animated Glowing Placement Indicators**:
   * Added glowing top/bottom indicator bars (`bg-duck-400 shadow-[0_0_8px_rgba(240,192,74,0.9)]`) clearly previewing exact drop placement above or below target notes.
3. **Optimistic State Updates & IndexedDB Synchronization (`components/Workspace.jsx` & `lib/storageService.js`)**:
   * Implemented `handleReorderNotes(spaceId, reorderedNotes)` in `Workspace.jsx` updating local state instantly.
   * Added `saveNotesOrder(spaceId, orderedNotes)` in `lib/storageService.js` assigning sequential `order` values (`0, 1, 2, ...`) and writing them via `db.notes.bulkPut`.
   * Updated `loadLocalWorkspace` to sort all notes within each space by `(a.order ?? 0) - (b.order ?? 0)` on initial load.
4. **Automated Verification**:
   * Added unit test suite in `tests/unit/note-persistence-flow.test.mjs` validating drag-to-reorder array operations, above/below insertions, and order ascending sorting. All **120 unit tests pass**.

---

## 47. Right-Click Context Menu Support for Editor Blocks

### Root Causes & Problem Statements
1. **Limited Menu Discovery**: The block context menu (AI Explain, Quiz me, formatting, Turn into, duplication, and reordering) was exclusively reachable by hovering over the left margin and clicking the small `⠿` drag handle.
2. **Standard Browser Menu Collision**: Right-clicking directly on any block content surfaced the default operating system / browser context menu rather than the rich SocraticOS block actions menu.

### Resolution & Architectural Enhancements
1. **`onContextMenu` Handler on Editor Blocks (`components/BlockNoteEditor.jsx`)**:
   * Attached an `onContextMenu` handler to `EditorBlock`'s container `<div>`.
   * Invokes `e.preventDefault()` and `e.stopPropagation()`, selects the target block (`onSelect(block.id)`), calculates mouse click coordinates relative to the block bounding rectangle, and opens the menu with `setMenuOpen(true)`.
2. **Cursor-Relative Context Menu Positioning & Keyboard Dismissal**:
   * Updated `BlockContextMenu` to accept an optional `position` (`{ x, y }`) prop, rendering precisely at the cursor location while remaining bounded within the editor.
   * Added an active `Escape` key listener (`window.addEventListener("keydown", onKeyDown)`) alongside outside click dismissal for seamless keyboard workflow.
3. **Universal Support Across All 19 Block Types**:
   * Works across text, headings, lists, tables, callouts, quotes, code, math, and canvas drawings.

---

## 48. Persistent Side-by-Side AI Study Sidebar & Note Visibility Overhaul

### Root Causes & Problem Statements
1. **Modal Backdrop Blur & Occlusion**: Previously, opening Explain, Quiz me, or Socratic Duck AI help rendered a full-screen backdrop overlay (`bg-ink-950/70 backdrop-blur-[2px]`) that blurred and darkened the active note, preventing the student from reading or referencing the note while studying.
2. **Accidental Dismissal on Note Interaction**: Clicks on the backdrop overlay triggered `onClose()`. Students attempting to select text, scroll through formulas, or read paragraphs in the note caused the study panel to abruptly vanish.

### Resolution & Architectural Enhancements
1. **Backdrop & Blur Removal (`components/Drawer.jsx`)**:
   * Completely eliminated the full-screen backdrop `<div>`, backdrop blur filter, and click-outside dismissal trigger.
   * Transformed the study container into an accessible, non-modal right sidebar (`w-full sm:w-[440px] md:w-[480px] lg:w-[500px] xl:w-[520px]`).
   * Explicit close handlers are preserved via the header `✕` button, `Escape` key shortcut, and top HUD toggle buttons.
2. **Dynamic Side-by-Side Viewport Resizing (`components/Workspace.jsx`)**:
   * Main workspace container adds a smooth transition margin offset (`lg:mr-[480px] xl:mr-[520px]`) when study panels are open.
   * The note editor in the center remains 100% visible, centered, scrollable, and fully editable alongside active AI explanations and interactive quizzes.
3. **Automated Verification**:
   * All **120 unit & integration tests across 43 test suites** pass. Production Next.js build succeeds with exit code 0.

---

## 49. Quiz Session Persistence, Race-Condition Locking & Generation De-duplication

### Root Causes & Problem Statements
1. **Asynchronous Overwrites & Race Conditions**: In-flight requests to `/api/quiz/generate` had no sequence checking or cancellation. If an earlier request took longer to resolve than a subsequent request (e.g. 119s timeout vs 4s retry), the stale response resolved later in the background and wiped out active `quiz` state, `answers`, and reset `index: 0` mid-test.
2. **Unstable Component Key Remounts**: `QuizRunner` was rendered with `key={`quiz-${concept}`}` in `QuizPanel.jsx`. Any parent re-render updating the concept string reference unmounted the quiz runner and destroyed in-progress answers.
3. **Missing Active Answering Lock**: `QuizRunner` lacked a state guard checking if `phase === "answering"`, allowing background effects to re-trigger question generation while the user was interacting with the quiz.

### Resolution & Architectural Enhancements
1. **Generation Sequence & Stale-Response Discard (`genSeqRef`)**:
   * Attached an incrementing request counter (`genSeqRef.current = ++seq`) to `generate()`. Responses are verified against the latest sequence ID, immediately discarding stale, out-of-order API returns.
2. **Active Session Lock**:
   * `generate(force = false)` checks if `lastConceptRef.current === concept && quiz && phase === "answering"`. If active, it preserves the existing quiz and refuses to regenerate unless explicitly triggered via `onRetake` (`generate(true)`).
3. **Stable Component Lifecycle (`components/QuizPanel.jsx`)**:
   * Removed unstable `key={`quiz-${concept}`}` and `key={`socratic-${concept}`}` props from `QuizPanel.jsx`.
   * Added `lastConceptRef` to `SocraticSession` to prevent accidental dialogue restarts during note editing.
4. **Parallel Protection in `ExplainPanel.jsx`**:
   * Added `lastConceptFocusRef` and `seqRef` to `ExplainPanel.jsx` to prevent duplicate conceptual loads and out-of-order async resolution.
5. **Automated Verification**:
   * All **120 unit & integration tests across 43 test suites** pass. Next.js production build succeeds with exit code 0.

---

## 50. Dedicated Quizzes Studio Tab with Custom AI Generation, Local Storage & Mastery Integration

### Requirements & Feature Scope
1. **Dedicated Quizzes Navigation Tab**: Inserted directly between 3D Orbit and Mastery in the Top HUD (`Notes` $\to$ `Calendar` $\to$ `Web Saver` $\to$ `3D Orbit` $\to$ `🎯 Quizzes` $\to$ `Mastery`).
2. **Comprehensive Custom Quiz Configuration**:
   * **Target Space & Source Note Selection**: Choose any note from the selected space.
   * **Note Scope & Sub-Section Focus**: Options for Whole Note, Specific Heading/Section (dynamically extracted from note blocks), or Custom Focus prompt.
   * **Difficulty Calibration**: 4 distinct cognitive difficulty tiers (🟢 Easy / Foundational, 🟡 Medium / Analytical, 🔴 Hard / Advanced Edge Cases, 🟣 Mastery / Expert Synthesis).
   * **Question Type Breakdown Controls**: Granular steppers for Multiple Choice (MCQ), Short Answer (mechanisms/reasoning), and Long Answer (essays/derivations) with live total questions counter.
3. **Local-First IndexedDB Persistence & 24h Trash Lifecycle**:
   * Stored in `db.quizzes` with pending/completed status, question counts, difficulty, and user responses.
   * Soft deletion to `db.quizTrash` with automatic 24-hour expiration purge, instant restoration, and permanent delete controls.
4. **Interactive Quiz Runner & Graded Review Screen**:
   * Interactive full exam interface with progress indicators, option selections, mechanism inputs, and essay word counters.
   * Detailed diagnostic report with animated score dial, sub-topic mastery heatmap, and question-by-question model rubric reviews.
5. **Mastery Dashboard Integration**:
   * Graded quiz submissions immediately write to `recordStudySession(...)`, rolling up into `summariseMastery` so students' overall scores, topic strengths, and subtopic status (Solid/Shaky/Gap) update in real-time.

### Resolution & Architectural Enhancements
1. **Database Schema Version Migration (`lib/db.js`)**:
   * Incremented to `db.version(6)` declaring `quizzes` and `quizTrash` tables.
2. **Storage Service API (`lib/storageService.js`)**:
   * Exported `getAllQuizzes()`, `getQuizzesBySpace(spaceId)`, `getQuizById(id)`, `saveQuiz(quizData)`, `deleteQuizToTrash(id)`, `getTrashQuizzes()`, `recoverQuiz(id)`, `permanentlyDeleteQuiz(id)`, `clearQuizTrash()`, and updated `factoryResetWorkspace()`.
3. **AI Route Enhancements (`app/api/quiz/generate/route.js`, `lib/schemas.js`, `lib/aiService.js`)**:
   * Added `long_answer` to `QUESTION_TYPES` and `QUIZ_SCHEMA`.
   * Updated generator route to accept `difficulty`, `mcqCount`, `shortAnswerCount`, `longAnswerCount`, `focus`, `title`, and construct calibrated Gemini prompts.
4. **UI Studio Views (`components/QuizStudioView.jsx`, `components/CreateQuizModal.jsx`)**:
   * Created rich, responsive studio dashboard with space filtering, search, difficulty filters, status tabs, interactive runner, review reports, and trash bin.
5. **HUD & Navigation Integration (`components/Workspace.jsx`, `components/CommandPalette.jsx`)**:
   * Added `🎯 Quizzes` tab button in HUD, view switcher in main body, and `Ctrl+K` command palette item.
6. **Automated Verification**:
   * Created [`tests/unit/quiz-studio-flow.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/quiz-studio-flow.test.mjs).
   * All **124 unit & integration tests across 44 test suites** pass. Production Next.js build (`npm run build`) succeeded with exit code 0.

---

## 51. Gemini OpenAPI Schema Validation & Overly Broad API Key Error Masking Fix

### Root Causes & Problem Statements
1. **Gemini OpenAPI Dialect Array Constraint Rejection**: `QUIZ_SCHEMA` defined `minItems: 1, maxItems: 30` on `questions` and `maxItems: 4` on `options`. Gemini's structured output OpenAPI dialect rejects these array bounds on nested dynamic arrays, returning HTTP 400 with `"Request contains an invalid argument."`.
2. **False "Invalid API Key" Error Masking**: In `lib/gemini.js`, the error handling used `/API key|invalid/i.test(message)`. Because the generic word `"invalid"` was matched, ANY HTTP 400 from Gemini saying `"Request contains an invalid argument"` was incorrectly intercepted and surfaced to the UI as `"Gemini API key is invalid or unauthorized. Please check your API key in Settings ⚙️ or .env.local."`, leading to confusion while `/api/explain` (which lacked the problematic schema bounds) worked normally.

### Resolution & Architectural Enhancements
1. **Cleaned `QUIZ_SCHEMA` (`lib/schemas.js`)**:
   * Removed unsupported `minItems`/`maxItems` constraints from `QUIZ_SCHEMA` in `lib/schemas.js`, relying on prompt directives (`distributionPrompt` in `/api/quiz/generate/route.js`) to strictly enforce the exact count of Multiple Choice, Short Answer, and Long Answer questions.
2. **Precise API Key Error Detection (`lib/gemini.js`)**:
   * Updated error interception in `lib/gemini.js` to strictly test for `/API_KEY_INVALID|API key not valid|API key is invalid|API key expired|UNAUTHENTICATED|PERMISSION_DENIED/i`, preventing generic validation failures from masquerading as API key authorization errors.
3. **Automated & Live Endpoint Verification**:
   * Validated live generation against the Gemini endpoint with `200 OK` JSON responses.
   * All **124 unit & integration tests across 44 test suites** pass. Next.js production build succeeds with exit code 0.

---

## 52. Heading Extractor Overhaul & Multi-Heading Checkbox Selection System

### Root Causes & Problem Statements
1. **Type Mismatch in Heading Filter**: The initial heading filter in `CreateQuizModal.jsx` searched for block types `["heading1", "heading2", "heading3", "heading"]`. However, SocraticOS `BlockNoteEditor` and markdown parsers store headings as `"h1"`, `"h2"`, `"h3"`, and `"h4"`, causing all notes with standard headings to report "No headings found in this note".
2. **Single-Heading Limitation**: Users could only select a single heading from a plain `<select>` dropdown, preventing multi-topic or multi-section quiz generation.
3. **Truncated / Missing Heading Metadata**: Dropdowns could not clearly display the heading hierarchy level (`H1`, `H2`, `H3`, `H4`) alongside the full heading text without ellipsis cutoffs.

### Resolution & Architectural Enhancements
1. **Centralized & Robust Heading Extractor (`lib/blocks.js`)**:
   * Implemented and exported `extractHeadingsFromBlocks(blocks)` in `lib/blocks.js`.
   * Matches `h1`–`h4`, `heading1`–`heading4`, `heading` with `props.level`, inline content arrays, and markdown headings (`#` through `####`) within text/paragraph blocks.
   * Cleans leading hashes, bold markers, and colons while returning `{ id, type, level, text }` with full string fidelity.
2. **Multi-Heading Checkbox Menu (`components/CreateQuizModal.jsx`)**:
   * Replaced the single dropdown with an interactive, scrollable Checkbox Selection Menu.
   * **Visual Hierarchy Badges**: Colored pills per heading level (Indigo `H1`, Emerald `H2`, Amber `H3`, Purple `H4`).
   * **Full Heading Display**: Word-wrapped, break-words layout rendering complete section titles without clipping.
   * **Quick Actions**: "Select All", "Clear", and dynamic selection counter (`X of Y selected`).
3. **Compound AI Prompt Generation**:
   * `handleGenerate` joins multiple selected headings into comprehensive target section instructions: `Target Sections: "Section 1", "Section 2"`.
4. **Automated Verification**:
   * Added unit tests in `tests/unit/quiz-studio-flow.test.mjs` verifying multi-type extraction (H1–H4, markdown embeds) and focus prompt construction.
   * All **126 unit & integration tests across 44 test suites** pass. Next.js production build succeeds with exit code 0.

---

## 53. Worked Through Example Object Deserialization & Structured Step Rendering

### Root Causes & Problem Statements
1. **Schema-Normalizer Data Type Incompatibility**: `EXPLAIN_SCHEMA` defines `workedExample.steps` as an array of structured objects (`{ step: string, explanation: string }`). However, `normalizeExplanation` in `app/api/explain/route.js` and `lib/aiService.js` was passing each object through `String(step)`, turning structured steps into `"[object Object]"` strings.
2. **Missing Field Deconstruction in UI**: In `components/ExplainPanel.jsx`, the "Worked through" section rendered `<span>{step}</span>` directly as a primitive string, resulting in the user interface displaying literal `01 [object Object]`, `02 [object Object]`, `03 [object Object]`.

### Resolution & Architectural Enhancements
1. **Structured Step Normalization (`app/api/explain/route.js`, `lib/aiService.js`)**:
   * Updated `normalizeExplanation` to parse each element of `workedExample.steps` into `{ step, explanation }`, gracefully supporting both structured objects and fallback strings.
   * Preserved `workedExample.problem` and `workedExample.takeaway` properties.
2. **Rich Two-Tier Step & Takeaway Rendering (`components/ExplainPanel.jsx`)**:
   * Updated `ExplainPanel.jsx` to deconstruct each step into a bold title (`step.step`) and descriptive explanation (`step.explanation`).
   * Added dedicated `💡 Takeaway` banner at the bottom of the worked example when present.
3. **Automated Verification**:
   * All **126 unit & integration tests across 44 test suites** pass. Next.js production build succeeds with exit code 0.

---

## 54. Max Output Token Capacity Increase & Quiz Stepper Range Expansion

### Objectives & Enhancements
1. **Doubled Gemini Output Token Ceiling (`lib/gemini.js`)**:
   * Increased `MAX_OUTPUT_TOKENS` from `4000` to `8192` (Gemini's maximum generation output limit), doubling the capacity for large multi-question exams, detailed essay grading rubrics, and deep conceptual walkthroughs without token truncation.
2. **Expanded Custom Quiz Stepper Limits (`components/CreateQuizModal.jsx`)**:
   * **Multiple Choice Questions (MCQ)**: Raised maximum stepper limit from `15` $\to$ **`40`**.
   * **Short Answer Questions**: Raised maximum stepper limit from `10` $\to$ **`20`**.
   * **Long Answer / Essay Questions**: Raised maximum stepper limit from `5` $\to$ **`10`**.
3. **Automated Verification**:
   * All **126 unit & integration tests across 44 test suites** pass. Next.js production build succeeds with exit code 0.

---

## 55. Gemini 3.5 Flash-Lite 32K Output Token Expansion & Mega-Quiz Capacity Upgrade

### Objectives & Enhancements
1. **Upgraded `MAX_OUTPUT_TOKENS` to 32,768 (`lib/gemini.js`)**:
   * Leveraged `gemini-3.5-flash-lite`'s native 65,536 output token architecture to expand the generation ceiling to **32,768 tokens**.
   * Provides massive runway for mega-quizzes, full semester exam generation, and multi-paragraph essay grading rubrics.
2. **Mega-Quiz Question Stepper Caps (`components/CreateQuizModal.jsx`)**:
   * **Multiple Choice Questions (MCQ)**: Raised stepper cap to **`60` questions**.
   * **Short Answer Questions**: Raised stepper cap to **`30` questions**.
   * **Long Answer / Essay Questions**: Raised stepper cap to **`20` questions**.
   * **Maximum Total Quiz Size**: Supports massive examinations up to **110 total questions** in a single generation session.
3. **Automated Verification**:
   * All **126 unit & integration tests across 44 test suites** pass. Next.js production build succeeds with exit code 0. Dev server active on port 3000.

---

## 56. Custom Accent-Gold Gradient Range Sliders & Direct Input Integration

### Root Causes & Problem Statements
1. **Unstyled Native Range Inputs**: Default browser HTML range sliders render generic gray/white square knobs with flat OS track styling that clashed with SocraticOS dark mode.
2. **Cramped Sub-Label Alignment**: Text buttons and labels below the slider appeared cramped and awkward in modal card viewports.

### Resolution & Architectural Enhancements
1. **Custom `quiz-slider` CSS Architecture (`app/globals.css`)**:
   * Configured dedicated cross-browser WebKit and Gecko slider styles with a circular gold thumb (`#f0c04a`), dark borders, ambient gold drop shadow, and smooth hover/active scaling.
   * Applied dynamic inline CSS `linear-gradient` track fills that follow the exact percentage value in real-time.
2. **Hybrid Slider & Direct Number Input (`components/CreateQuizModal.jsx`)**:
   * Integrated a two-way interactive number input badge with `/ {max}` indicator allowing instant typing or dragging.
   * Clear proportional indicator rendering `0`, `{value} questions`, and `{max}` cleanly across the base of each card.
3. **Automated Verification**:
   * All **126 unit & integration tests across 44 test suites** pass. Next.js production build succeeds with exit code 0. Dev server active on port 3000.

---

## 57. Quizzes Tab Subsystem Comprehensive Bug Audit & End-to-End Resolution

### Root Causes & Problem Statements
1. **Client AI MCQ Objective Grading Bug (`lib/aiService.js`)**:
   * `gradeObjectively` converted `answer` via `Number(answer)`. In JS, `Number("") === 0`.
   * When a learner left a multiple choice question blank or skipped it (`quizAnswers[i] = ""`), the client AI graded it as option index `0` (Option A). If Option A was the correct option, unanswered questions were marked **CORRECT**.
2. **Missing Subtopic Heatmap Fallback Synthesis in Client AI (`lib/aiService.js`)**:
   * `normalizeQuizResult` in `lib/aiService.js` lacked fallback synthesis (`fallbackHeatmap(gradedAnswers)`). When Gemini omitted heatmap entries, `heatmap` became `[]`, breaking the Confidence Heatmap component and populating empty arrays into `db.studySessions`.
3. **Retaking Quiz Retained Old Answers (`components/QuizStudioView.jsx`)**:
   * `handleStartQuiz` loaded `quiz.userAnswers || {}` when starting a quiz. When retaking a completed quiz, all old answers remained pre-selected, defeating the purpose of testing knowledge again.
4. **Mastery Dashboard Sync Delay (`components/Workspace.jsx`)**:
   * When a quiz was completed in `QuizStudioView`, `recordStudySession` saved it to `db.studySessions`, but `Workspace.jsx` held `sessions` in static local state, causing the top-bar `gapCount` badge and `MasteryDashboard` not to reflect new sessions without page reload.
5. **Incomplete Note Context During Quiz Grading (`components/QuizStudioView.jsx`)**:
   * In `handleSubmitQuiz`, `noteContent` sent to `/api/quiz/grade` was `takingQuiz.focusText || takingQuiz.noteTitle || ""`. When `scope === "whole"`, `focusText` was empty, sending only the title rather than the note's text content.
6. **Note Content Serialization Dropped Tables, Formulas & Toggles (`lib/blocks.js`)**:
   * `editorBlocksToText` returned `""` when `!content`. `table` blocks store data in `tableData` while `content` is empty; `toggle` blocks stored details in `details`. This caused tables, LaTeX math equations, and toggles to be omitted from quiz generation and grading.
7. **Static Source Note on Quiz Cards (`components/QuizStudioView.jsx`)**:
   * The quiz card displayed the source note title as static text without quick-jump navigation into the editor.
8. **Create Quiz Modal State Reset Bug on Background Updates (`components/CreateQuizModal.jsx`)**:
   * `useEffect` had `[open, activeSpace, notesBySpace]`. If `notesBySpace` updated in the background, user input (custom title, selected note) was wiped mid-typing.
9. **24h Quiz Trash Auto-Purge Reactivity (`components/QuizStudioView.jsx`)**:
   * `trashedQuizzes` used raw `db.quizTrash.toArray()` without filtering out items deleted > 24 hours ago.
10. **ScoreRing NaN Guard (`components/ScoreRing.jsx`)**:
    * If `score` was null/undefined, SVG `strokeDashoffset` computed `NaN`.
11. **Defensive AI Normalizers Against Malformed/Null Payloads (`lib/aiService.js`, `app/api/quiz/...`)**:
    * Prevented unhandled `TypeError` exceptions on null response objects via optional chaining and positional `gradedAnswers` fallback.

### Resolution & Architectural Enhancements
1. **Strict MCQ Objective Grading (`lib/aiService.js`)**:
   * Applied strict validation `const isProvided = answer !== null && answer !== undefined && answer !== ""; const picked = isProvided ? Number(answer) : NaN; const answered = Number.isInteger(picked) && picked >= 0;`.
2. **Subtopic Heatmap Synthesis (`lib/aiService.js`)**:
   * Ported `fallbackHeatmap` generator and validated heatmap statuses against `HEATMAP_STATUSES`.
3. **Clean Slate Quiz Retakes (`components/QuizStudioView.jsx`)**:
   * Updated `handleStartQuiz(quiz, isRetake = false)` to set `quizAnswers` to `{}` when retaking or when the quiz status is `completed`.
4. **Reactive Mastery Synchronization (`components/Workspace.jsx`)**:
   * Added `liveSessions` query using `useLiveQuery` to reactively update `sessions` and `gapCount` whenever a quiz finishes in QuizStudio.
   * Enhanced `handleSelectNote` to support note ID strings and cross-space lookups.
5. **Dynamic Note Content Resolution (`components/QuizStudioView.jsx`)**:
   * Dynamically resolved source note text via `getNoteById(takingQuiz.noteId)` and `editorBlocksToText` to pass full context to grading models.
6. **Rich Block Text Serialization (`lib/blocks.js`)**:
   * Enhanced `editorBlocksToText` to serialize `table` blocks (`tableData`), `toggle` blocks (`details`), and `math`/`inlinemath` equations.
7. **Clickable Source Note Navigation (`components/QuizStudioView.jsx`)**:
   * Converted static note label into an interactive button that jumps directly to the source note in the editor.
8. **Modal State Guarding (`components/CreateQuizModal.jsx`)**:
   * Guarded modal state with `prevOpenRef` and added a quick "Switch to Whole Note" button when notes have no headings.
9. **24h Auto-Purge & Safe ScoreRing (`components/QuizStudioView.jsx`, `components/ScoreRing.jsx`)**:
   * Filtered expired 24h trash items and added finite number validation to `ScoreRing`.
10. **Automated Verification**:
    * All **131 unit & integration tests across 44 test suites** pass. Clean build succeeds with 0 errors. Dev server active on port 3000.

---

## 58. Next.js Production Build Artifact Collision Purge & Hot-Reload Stabilization

### Root Causes & Problem Statements
1. **Next.js Webpack Pack File Collision**: Running `next dev` immediately following a production `next build` without clearing `.next` caused webpack to search for stale `.pack.gz` cache chunks and mismatched `middleware-manifest.json` / `routes-manifest.json`, throwing `ENOENT` unhandled rejections on dynamic API routes.

### Resolution & Architectural Enhancements
1. **Cache Purge & Clean Initialization Protocol**:
   * Terminated stale port 3000 node processes and purged `.next` cache directory.
   * Launched fresh `next dev` server on port 3000, eliminating webpack cache collisions.
2. **Automated Verification**:
   * Validated live server startup (`Ready in 4.5s`) and endpoint compilation. Dev server active on `http://localhost:3000`.

---

## 59. Quiz Me Generator Default Question Expansion (5 MCQs + 3 Short Answers)

### Root Causes & Problem Statements
1. **Compact Default Quiz Sizing**: Previously, the quick "Quiz me" button (which opens `QuizPanel.jsx`) and the default quiz distribution generated only 3 multiple-choice and 2 short-answer questions (5 total), which did not provide deep diagnostic coverage of complex note topics.

### Resolution & Architectural Enhancements
1. **Quick Quiz Drawer Configuration (`components/QuizPanel.jsx`)**:
   * Updated the Quick quiz drawer payload to explicitly request `{ mcqCount: 5, shortAnswerCount: 3, longAnswerCount: 0 }`.
   * Updated mode tab hint to `"8 questions, graded"`.
2. **API & Client AI Service Synchronized Defaults (`app/api/quiz/generate/route.js` & `lib/aiService.js`)**:
   * Updated default `numMCQ = 5` and `numShort = 3` with distribution prompt `Generate exactly 5 'multiple_choice' question(s) and 3 'short_answer' question(s). Total 8 questions.`
3. **Storage & Modal Defaults (`components/CreateQuizModal.jsx` & `lib/storageService.js`)**:
   * Set initial modal slider states and default storage record counts to `{ mcq: 5, shortAnswer: 3, longAnswer: 0 }`.
4. **Automated Verification**:
   * All **131 unit & integration tests across 44 test suites** pass. Production build succeeds with 0 errors. Dev server active on port 3000.

---

## 60. Academic Syllabus & Curriculum Boundary Feature (Settings > General)

### Root Causes & Problem Statements
1. **Out-of-Scope Grade Penalty During Grading**: The AI grader was penalising IGCSE Grade 10 students for not including A-Level or university-level content (e.g., advanced thermodynamics, quantum mechanics) in their short answers — content that is explicitly **outside** their syllabus. There was no mechanism to constrain the AI to the student's curriculum level.
2. **No Syllabus Scope for Question Generation**: Quiz generation had no curriculum-awareness, meaning a student studying IGCSE Biology could receive questions covering A-Level material (e.g., enzyme kinetics at biochemical detail beyond the IGCSE scope).
3. **No Student-Facing Syllabus Configuration**: There was no UI for students to specify their grade level or upload a syllabus document so all AI features (quizzes, grading, explanations, Socratic chat) could adapt to their curriculum.

### Resolution & Architectural Enhancements

#### Storage Layer (`lib/storageService.js`)
- Added `getSyllabusStatement()`: Reads `socratic_syllabus_statement` (text) and `socratic_syllabus_enabled` (bool) from `db.settings`.
- Added `saveSyllabusStatement(statement, enabled)`: Persists both keys atomically to `db.settings`.

#### Client-Side AI Service (`lib/aiService.js`)
- Added `getEffectiveSyllabus(providedSyllabus)`: If `providedSyllabus` is explicitly passed, uses it directly; otherwise reads the enabled syllabus from IndexedDB at call-time.
- Updated `quizGenerate`, `quizGrade`, and `explainConcept` to call `getEffectiveSyllabus` and inject a strict curriculum constraint XML block into every prompt.

#### Server Routes — Syllabus Injection
- **`app/api/quiz/generate/route.js`**: Accepts `syllabus` in JSON body; injects `<syllabus_statement>` into the generation system prompt with explicit constraints: restrict to stated curriculum, do not include higher-grade content, do not penalise students for expected scope.
- **`app/api/quiz/grade/route.js`**: Accepts `syllabus`; injects strict grading directive instructing the LLM to award full marks for correct syllabus-level answers and never deduct marks for omitting post-IGCSE/A-Level/University concepts.
- **`app/api/explain/route.js`**: Forwards `syllabus` to `buildPrompt()`, calibrating explanation vocabulary and cognitive depth to the student's stated curriculum.
- **`app/api/socratic/chat/route.js`**: Forwards `syllabus` to `buildSystemPrompt()`, calibrating probing Socratic questions to the student's curriculum scope.

#### Component Wiring
- **`components/QuizPanel.jsx`**: Reads `getSyllabusStatement()` on mount and injects `syllabus` into Quick Quiz `generate`, `submit`, `askDuck`, and `endSession` calls.
- **`components/CreateQuizModal.jsx`**: Reads `getSyllabusStatement()` on modal open; displays an active curriculum scope badge; passes syllabus in `handleGenerate` payload.
- **`components/QuizStudioView.jsx`**: `handleSubmitQuiz` reads `getSyllabusStatement()` and appends `syllabus: syllabusEnabled ? syllabus : ""` to the grading payload sent to `/api/quiz/grade` or `quizGrade`.

#### Settings UI (`components/Sidebar.jsx` — General Tab)
- New **"🎓 Academic Syllabus & Curriculum Boundaries"** section added to the General settings tab:
  - **Enable/Disable Toggle**: `socratic_syllabus_enabled` checkbox toggle; instantly calls `saveSyllabusStatement` on change.
  - **Quick Preset Chips**: One-click preset buttons for *IGCSE Gr.10 (Cambridge)*, *GCSE / O-Level*, *IB MYP 4-5*, *AP / A-Level Gr.11-12*, *Middle School Gr.6-8*, and *Clear*.
  - **Syllabus Textarea**: Resizable multi-line editor (max 8000 chars) with live character counter; disabled visually when toggle is off.
  - **File Upload**: Hidden `<input type="file">` accepting `.txt`, `.md`, `.docx`; DOCX is parsed via dynamic `mammoth` import (`mammoth.extractRawText({ arrayBuffer })`).
  - **Save Button**: "💾 Save Syllabus" button with ephemeral "✅ Saved!" confirmation flash (2s).
  - **Active Status Banner**: Green `emerald` status badge when syllabus is set + enabled; grey muted badge when disabled.
  - Imported `getSyllabusStatement` and `saveSyllabusStatement` from `@/lib/storageService.js`.

### Automated Verification
- Production build (`npm run build`) succeeded with **0 errors** and **0 warnings** after all changes.
- Dev server restarted successfully on `http://localhost:3000`.

---

## 61. Sidebar Note Drag-and-Drop Reordering Engine & Order Preservation Overhaul

### Root Causes & Problem Statements
1. **`dragleave` Bubbling State Reset (`components/Sidebar.jsx`)**:
   * In HTML5 Drag and Drop, hovering across child elements inside a note item (`<button>`, `<span>`, `<div>`, `<NoteMenu>`) fired `dragleave` on the parent `<li>` element.
   * Without checking `!e.currentTarget.contains(e.relatedTarget)`, `dragOverInfo` state was prematurely wiped to `null`.
   * On drop, `dragOverInfo` was `null`, causing `dragOverInfo?.position === "bottom"` to evaluate to `false` and defaulting to inserting before the target note (`top`) even when dropped on the lower half.
2. **Order Overwrite on Auto-Save & Manual Save (`lib/storageService.js` & `components/Workspace.jsx`)**:
   * In `Workspace.jsx` `handleSaveNote()`, `noteData` omitted the `order` property.
   * In `storageService.js` `saveNote()`, missing orders defaulted to `0` (`typeof noteData.order === "number" ? noteData.order : 0`).
   * As soon as any reordered note was edited (typing, auto-save, Ctrl+S, toggling favorite, renaming), its `order` in IndexedDB was overwritten with `0`.
   * With multiple notes holding `order: 0`, reload and retrieval queries sorted them non-deterministically, causing reordered notes to randomly jump to index 0 or shift positions.
3. **Sequential Order Missing on Note Creation & Instant Notes**:
   * `handleCreateNote()` and `handleSaveInstantNote()` created notes without computing an `order` index, defaulting to `order: 0` in IndexedDB despite appending to the end of the state array. On reload, the new note jumped to the top.
4. **Missing Order Field in Import and Unsorted Return Queries**:
   * `handleImportSuccess` omitted `order` when reconstructing notes from IndexedDB and did not sort spaces by order ascending.
   * `getAllNotes()` and `getNotesBySpace()` in `storageService.js` did not sort by `order` ascending.
   * `seedDemoContent()` saved demo notes with `order: undefined`.

### Resolution & Architectural Enhancements
1. **Direct Coordinate Drop Calculation & DragLeave Protection (`components/Sidebar.jsx`)**:
   * Updated `onDragLeave` to only clear `dragOverInfo` when `!e.currentTarget.contains(e.relatedTarget)`.
   * In `onDrop`, calculated drop position directly from event coordinates (`e.clientY >= rect.top + rect.height / 2`), eliminating reliance on asynchronous React state that could have been wiped during bubbling.
   * Added drop target on the bottom container so dragging below all notes cleanly places the note at the end of the list.
2. **Atomic Order Preservation in Storage Service (`lib/storageService.js`)**:
   * Updated `saveNote()`: if `noteData.order` is provided as a number, it is used directly; if `undefined`, it fetches the existing note from IndexedDB and preserves `existing.order` and `existing.createdAt`. For new notes, it counts existing notes in the space to assign the next available order index.
   * Updated `getAllNotes()` and `getNotesBySpace()` to return notes deterministically sorted by `(a.order ?? 0) - (b.order ?? 0)` with stable secondary tie-breakers (`createdAt` / `id`).
   * Updated `seedDemoContent()` to assign sequential `order: 0, 1, 2, ...` per space.
3. **Consistent Order Management in Workspace Handlers (`components/Workspace.jsx`)**:
   * Updated `handleSaveNote()` to preserve `order`.
   * Updated `handleCreateNote()`, `handleSaveInstantNote()`, and trash recovery handlers (`handleRecoverNote`, `handleRecoverAllNotes`) to compute and set sequential `order` values.
   * Updated `handleImportSuccess()` to retain `order` and sort notes by order ascending.
   * Updated `handleReorderNotes()` to re-index all notes with `order: index` before writing to state and IndexedDB via `saveNotesOrder()`.
4. **Automated Verification**:
   * Added unit tests verifying direct coordinate calculations, drop-to-bottom container, auto-save order preservation, and multi-key deterministic sorting in `tests/unit/note-persistence-flow.test.mjs`.
   * All **103 unit tests** and **16 integration tests** pass with exit code 0. Production build succeeds with 0 errors. Dev server active on port 3000.

---

## 62. Decluttering: Ghost Action Icons, Progressive Disclosure Headers & Global Navigation Refactoring

### Root Causes & Problem Statements
1. **Visual Clutter in Left Sidebar Notes List**:
   * Drag handles (`GripVertical`) and 3-dot note menus (`NoteMenu`) were permanently visible on every note row in the sidebar, causing heavy visual noise and making reading note titles difficult.
2. **Heavy Header on Empty Notes in Editor**:
   * Opening a new note immediately presented large empty cover buttons and icon buttons, cluttering the top of the writing canvas.
3. **Misalignment of Global vs Space-Specific Tools in Navigation**:
   * The top HUD bar previously intermingled global tools (3D visualizations, Calendar, Web Saver) with space-specific study tools (Notes, Quizzes, Mastery), creating confusion over what data was scoped to the active space.

### Resolution & Architectural Enhancements
1. **Ghost Action Icons on Sidebar Notes (`components/Sidebar.jsx`)**:
   * Applied `opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity` to `GripVertical` and `NoteMenu` buttons. The action controls remain completely hidden until hovering a specific note row.
2. **Progressive Disclosure Headers in Note Editor (`components/BlockNoteEditor.jsx`)**:
   * Designed a Notion-like hover header where notes without covers render as clean typing canvases. Hovering above the title smoothly fades in `[ 😀 Add Icon ]` and `[ 🖼️ Add Cover ]` action pills.
3. **Dedicated Global Tools Section & Space-Specific Study Suite (`components/Sidebar.jsx` & `components/Workspace.jsx`)**:
   * Top navigation bar streamlined strictly to the 3 space-specific views: 📝 **Notes**, 🎯 **Quizzes**, and 📊 **Mastery** (with `gapCount` badge).
   * Sidebar equipped with a dedicated "Global Tools" section containing 🌌 **3D Simulations**, 📅 **Calendar**, and 🔖 **Web Saver** with active tab indicators and unified `GlobalTimerHUD`.

---

## 63. Truly Global Web Saver & Calendar, NoteMenu AI Reformat & Compact Instant Note Button

### Root Causes & Problem Statements
1. **Web Saver Space Isolation**:
   * `WebSaverView.jsx` previously filtered folders and bookmarks strictly by `(f.spaceId || "School") === activeSpace`, isolating bookmarks to individual spaces rather than acting as a universal global web research vault.
2. **Navigation Naming Inconsistency**:
   * The calendar tool was labeled "Calendar & Timers" and "Study Calendar & Timers" across different views instead of the concise title "Calendar".
3. **Editor Reformat Clutter**:
   * Separate standalone `✨ Reformat Note` buttons in the cover banner and title hover strip cluttered the document editor canvas.
4. **Oversized Instant Note Button**:
   * The large gradient Instant Note banner in the sidebar consumed vertical space, pushing the spaces dropdown and note list downward.

### Resolution & Architectural Enhancements
1. **Global Web Saver Vault (`components/WebSaverView.jsx`)**:
   * Removed space-filtering from `folders` and `bookmarks` (`const spaceFolders = useMemo(() => folders || [], [folders])` and `const spaceBookmarks = useMemo(() => bookmarks || [], [bookmarks])`).
   * Updated Netscape HTML import/export and deletion confirmation modals to operate globally across all folders and bookmarks in the vault.
2. **Concise "Calendar" Labeling (`components/Sidebar.jsx` & `components/Workspace.jsx`)**:
   * Standardized button labels, focus mode strips, and breadcrumb indicators to `"Calendar"`.
3. **AI Note Reformat Integrated into NoteMenu (`components/NoteMenu.jsx`, `components/BlockNoteEditor.jsx`, `components/Workspace.jsx`)**:
   * Added `✨ Reformat Note (AI)` item inside the `NoteMenu` dropdown across the workspace header and sidebar note items.
   * Removed standalone Reformat buttons from the editor banner and title hover strip while retaining animated floating feedback toasts (`reformatToast`) during execution.
4. **Miniaturized Instant Note Quick Action (`components/Sidebar.jsx`)**:
   * Removed the bulky gradient banner button and placed a sleek, compact `⚡` button in the top brand row with tooltip `Instant Note (Ctrl+I)` next to Settings `⚙️`.
5. **Automated Verification & Production Protocol**:
   * All **119 unit and integration tests** pass in 760ms.
   * Clean `npm run build` production compilation in 8.3s.
   * Production server running on `http://localhost:3000`.

---

## 64. WebSaver Client-Side Exception (ReferenceError: spaceId is not defined) & Null-Guard Hardening

### Root Causes & Problem Statements
1. **Residual `spaceId` Dependency in `AddBookmarkModal.jsx`**:
   * When removing the "Target Space" dropdown selector to make Web Saver global, `const [spaceId, setSpaceId]` state was removed, but `spaceId` remained in the `useEffect` keyboard event listener dependency array (`[open, url, title, spaceId, folderId, notes, tags]`).
   * When the user navigated to the Web Saver tab, mounting `AddBookmarkModal` evaluated the dependency array and threw `Uncaught ReferenceError: spaceId is not defined`, crashing the React render tree with a Next.js client-side exception popup.
2. **Unsafe Folder Tree Construction (`components/WebSaverView.jsx`)**:
   * In `folderTree` builder, if any folder item in IndexedDB had an orphaned or nonexistent `parentId`, `map[f.id]` or `map[f.parentId]` returned `undefined`.
   * Pushing `undefined` into the `roots` array caused `FolderTreeItem` at runtime to attempt reading `folder.id`, throwing `TypeError: Cannot read properties of undefined (reading 'id')`.

### Resolution & Architectural Enhancements
1. **Clean Dependency Array in `AddBookmarkModal.jsx`**:
   * Removed undefined `spaceId` from the `useEffect` dependency array (`[open, url, title, folderId, notes, tags]`).
2. **Defensive Folder Tree Builder (`components/WebSaverView.jsx`)**:
   * Filtered all `folders` and `bookmarks` arrays through `Array.isArray(...) ? ...filter(Boolean) : []`.
   * Added `if (f && f.id && map[f.id])` guards before linking children or pushing to roots, with `f.parentId !== f.id` circular reference protection.
3. **Subcomponent Null Guards (`FolderTreeItem`, `BookmarkGridCard`, `BookmarkListItem`, `currentFolderLabel`)**:
   * Added early returns `if (!folder || !folder.id) return null;` and `if (!bookmark || !bookmark.id) return null;`.
   * Added safe fallback `extractDomain(bookmark.url || "")` and `spaceFolders.find((f) => f && f.id === selectedFolderId)`.
4. **Automated Verification & Production Protocol**:
   * All **119 unit and integration tests** passed.
   * `npm run build` compiled cleanly in 8.4s.
   * Production server running on `http://localhost:3000`.

---

## 66. UI Streamlining, Elimination of Dual Top Bars & 1-Click Zen Focus Mode

### Root Causes & Problem Statements
1. **Vertical Space Consumption & Redundant Stacked Header Bars**:
   * Previously, the workspace rendered **two stacked header bars** (a 56px top breadcrumb/tab bar and a 48px note sub-bar), taking over 104px of vertical height.
   * The active note title was displayed redundantly in three places at once (breadcrumbs, sub-bar, and editor canvas).
2. **Text-Heavy Note Menu & Crowded Sidebar Actions**:
   * The Note Menu in the header contained bulky text buttons ("Note Menu") and duplicate actions.
   * Top bar controls lacked a simple distraction-free Zen/Focus mode.

### Resolution & Architectural Enhancements
1. **Single Unified Top Navigation Bar (`Workspace.jsx`)**:
   * Merged all header elements into a single sleek 52px (`h-13`) top bar.
   * Left: Sidebar toggle + breadcrumb path (`📁 Space / 📝 Note Title` with favorite star indicator `⭐`).
   * Center: Space study tabs (`📝 Notes`, `🎯 Quizzes`, `📊 Mastery` with gap count badge).
   * Right: Save status indicator, `✨ Explain`, `🦆 Quiz me`, textless 3-dots Note Menu, and Zen Focus Mode toggle.
   * Completely eliminated the secondary 48px sub-bar, freeing vertical space across all tabs.
2. **Textless 3-Dots Note Menu (`NoteMenu.jsx`)**:
   * Refined `variant="icon"` to render a clean, high-contrast 3-dots (`...` / `MoreHorizontal`) icon button without bulky text.
3. **1-Click Zen Focus Mode (`Workspace.jsx`)**:
   * Added `isZenMode` state and global keyboard shortcuts (`Ctrl+Shift+F` / `Cmd+Shift+F` and `Escape`).
   * In Zen Focus Mode, sidebars and top bars are hidden, rendering an edge-to-edge reading/writing experience with a floating glassmorphic exit pill (`[ ⤢ Exit Focus Mode (Esc) ]`).
4. **Sidebar Streamlining (`Sidebar.jsx`)**:
   * Refined brand row with aligned utility icon buttons (Support, Feedback, Settings).
   * Polished Global Tools grid and Timer HUD integration with clean active states and compact margins.

---

## 67. Explain & Quiz Drawer Decoupling from Top Navigation Bar Width

### Root Causes & Problem Statements
1. **Top Navigation Bar Squishing on Drawer Open**:
   * Previously, `studyKind ? "lg:mr-[480px] xl:mr-[520px]" : ""` was attached to the outer workspace container that wrapped both the top `<header>` and `<main>`.
   * When Explain or Quiz was opened, the top header was compressed and shrunk by 480px–520px, causing breadcrumbs, study tabs, and action buttons to collapse into a tiny, cramped space.
   * `Drawer.jsx` was positioned with `top-0`, overlaying the top header area.

### Resolution & Architectural Enhancements
1. **Full-Width Top Header Preservation (`Workspace.jsx`)**:
   * Removed drawer push margin from the outer wrapper and applied it exclusively to `<main>` (`studyKind ? "lg:mr-[480px] xl:mr-[520px]" : ""`).
   * The top navigation header remains 100% full width and completely unobstructed at all times.
2. **Anchored Drawer Placement (`Drawer.jsx`)**:
   * Updated `Drawer.jsx` to mount below the 52px top bar (`top-13 bottom-0 h-[calc(100vh-3.25rem)]` at `z-[55]`).
   * All top bar triggers (`✨ Explain`, `🦆 Quiz me`, `...` NoteMenu, Zen toggle) remain fully accessible and interactive while drawers are open.

---

## 68. Zen Focus Mode Dismissal of Active Study Drawers & Margin Elimination

### Root Causes & Problem Statements
1. **Unclosed Study Drawer During Focus Mode**:
   * When Focus / Zen mode was toggled (`Ctrl+Shift+F` or button) while an Explain or Quiz drawer was open, the top navigation header collapsed, but the study drawer remained open with an unwanted top gap and right push margin, resulting in a misaligned layout.

### Resolution & Architectural Enhancements
1. **Automatic Drawer Dismissal on Zen Mode Toggle (`Workspace.jsx`)**:
   * Updated `toggleZenMode` to automatically clear `studyKind` (`setStudyKind(null)`).
   * Added `!isZenMode` guards to `<main>` right margin (`!isZenMode && studyKind ? ... : ""`) and to `ExplainPanel` / `QuizPanel` `open` props (`open={!isZenMode && studyKind === "..."}`).
   * Entering Focus Mode immediately produces a clean, edge-to-edge full-screen reading/writing canvas with zero gaps or lingering drawers.

---

## 69. List Item Content Preservation on Enter Key at Offset 0

### Root Causes & Problem Statements
1. **Accidental Content Deletion on Enter Key at Start of List Item**:
   * In `components/BlockNoteEditor.jsx`, when Enter was pressed inside a list item (`bullet`, `number`, `todo`, `toggle`, etc.), the editor split the DOM text into `textBefore` and `textAfter`.
   * When the cursor was positioned at index 0 (before the first letter of a non-empty list item), `textBefore` was empty (`""`) and `textAfter` held the item's text.
   * The list exit check was previously written as `if (["bullet", ...].includes(block.type) && !textBefore.trim()) { onChangeType(block.id, "text"); return; }`.
   * Because `textBefore` was empty, the condition evaluated to `true`, converting the block into an empty text block and returning immediately, which permanently discarded `textAfter` and deleted the user's text.

### Resolution & Architectural Enhancements
1. **Strict Empty List Exit Guard (`BlockNoteEditor.jsx`)**:
   * Updated the condition to `if (["bullet", "number", "todo", "toggle", "callout", "quote"].includes(block.type) && !textBefore.trim() && !textAfter.trim())`.
   * A list item only converts into a text paragraph if the entire block is empty.
   * When Enter is pressed at index 0 of a list item with text, the current list block becomes empty and `onAddAfter(block.id, textAfter, nextType)` creates the new list item with the text cleanly preserved.
2. **Automated Unit Verification**:
   * Added unit test suite in `tests/unit/note-persistence-flow.test.mjs` verifying clean splitting and text preservation when Enter is pressed at offset 0, midway, and on empty list items.

---

## 70. Backspace Caret Jump Elimination & Deepest Text Node Focus

### Root Causes & Problem Statements
1. **Cursor Jumping to Next Word on Backspace Across List Blocks**:
   * Previously, when pressing Backspace on an empty list item or when merging into a previous block, the editor invoked `window.getSelection().selectAllChildren(el)` followed by `collapseToEnd()`.
   * On contenteditable element containers (with inline formatted nodes, math pills, or multiple child nodes), `selectAllChildren(el).collapseToEnd()` placed the selection on the container element itself (`focusNode = el`, `offset = childNodes.length`) rather than the deepest text node.
   * Browsers resolving cursor position from an element-level boundary caused the caret to jump past the last word or to the start of the next node.
   * Additionally, when merging text blocks, React re-renders asynchronously wiped `innerHTML` via `useEffect`, detaching the text node where the range was positioned and causing caret displacement.

### Resolution & Architectural Enhancements
1. **Deep Text-Node Caret Positioning Utilities (`BlockNoteEditor.jsx`)**:
   * Implemented `setCaretToEnd(el)`, `setCaretToStart(el)`, and `setCaretAtOffset(el, targetOffset)`.
   * Uses `document.createTreeWalker(el, NodeFilter.SHOW_TEXT)` to target the deepest text node directly (`range.setStart(lastTextNode, lastTextNode.length)`).
2. **Synchronous DOM Mutation on Merge**:
   * Updated the block merging handler to synchronously execute `setBlockDOMFromText(targetEl, mergedContent, prevBlock.type)` and position the caret at `setCaretAtOffset(targetEl, prevContent.length)` before React state reconciliation, preventing re-render DOM wipes and ensuring rock-solid caret anchoring.
3. **Automated Unit Verification**:
   * Added unit test suite in `tests/unit/note-persistence-flow.test.mjs` verifying Backspace deletion of empty list items and exact caret offset calculations on block merge.

---

## 71. Dual-Range DOM Split, KaTeX Internal Node Filtering, Bullet Marker Cleaning & Atomic Math Caret Isolation

### Root Causes & Problem Statements
1. **Text Truncation on Line Splits (e.g., "Word Equation" -> "qeation")**:
   * When Enter was pressed midway through a formatted block (containing bold `**`, inline math `$formula$`, or tags), the editor previously serialized the range before the caret into Markdown text `textBefore`, and sliced the remaining text via `fullText.slice(textBefore.length)`.
   * Because `textBefore` included Markdown syntax delimiters (such as `**` or `$` formula wrappers) synthesized by `getBlockTextFromDOM`, `textBefore.length` was longer than the raw character index in `fullText`.
   * Slicing with this inflated offset chopped off the first few characters of the new line, mangling words like `"Word Equation"` into fragments like `"qeation"`.
2. **Raw Markdown Delimiters Leaking into Editable Content**:
   * Repeated serialization and re-formatting without clean Range boundaries caused delimiter characters (`**`, `*`) to leak into text nodes.
3. **Cursor Trapping and Erratic Typing Near Inline Formula Pills**:
   * Inline math pills (`<span class="katex-inline-node" contenteditable="false">`) contain dozens of nested `<span>` elements and text nodes generated by KaTeX.
   * `TreeWalker` functions (`createTreeWalker(el, NodeFilter.SHOW_TEXT)`) walked into KaTeX's internal DOM, corrupting `charCount`, caret offset calculations, and causing the browser caret to jump into math pills or past words.
4. **Leftover Bullet Symbols on New Lists**:
   * Splitting or starting a bullet line inherited literal `* ` or `- ` markers at the beginning of the editable sentence alongside the bullet icon.

### Resolution & Architectural Enhancements
1. **Dual-Range DOM Tree Cloning (`splitBlockDOMAtRange`)**:
   * Replaced fragile string slicing with `splitBlockDOMAtRange(container, range)`.
   * Directly clones `beforeRange` (`[0, caret]`) and `afterRange` (`[caret, end]`) into isolated DOM fragments, serializing each part independently.
   * 100% eliminates text truncation across all formatted blocks and math equations.
2. **KaTeX Internal Node Filtering in TreeWalkers**:
   * Updated `setCaretToEnd`, `setCaretToStart`, and `setCaretAtOffset` with node filters that reject any text nodes inside `.katex-inline-node`.
   * Treats inline math pills as atomic blocks during caret offset calculations, preventing cursor displacement and letter swallowing.
3. **Inherited Bullet Marker Sanitization**:
   * Added automated cleaning of redundant leading markers (`* `, `- `, `• `, `1. `, `[ ] `) when splitting or continuing list blocks.
   * Typing bullet shortcuts inside an existing bullet block updates the content without redundant type changes.
4. **Automated Verification & Production Protocol**:
   * All unit and integration tests passing in `tests/unit/note-persistence-flow.test.mjs`.
   * Production build (`npm run build`) succeeded with zero errors.
   * Production server live on `http://localhost:3000`.

---

## 72. List Block Keyboard Architecture, Unified Backspace Un-listing & Caret Synchronization

### Root Causes & Problem Statements
1. **Premature Block Concatenation on Backspace at Offset 0 (`idx > 0`)**:
   * When the caret was placed at offset 0 of a non-empty list block (`bullet`, `number`, `todo`, `toggle`, `h1`–`h4`, `quote`, `callout`) at `idx > 0`, the editor immediately concatenated the block with `prevBlock`, mangling headings and lists into runaway single blocks instead of removing list formatting first.
2. **Instant Deletion of Empty List Blocks & Focus Loss**:
   * Pressing Backspace on an empty list item immediately deleted the block when `blocks.length > 1` (skipping the un-list transition). When `idx === 0` in multi-block notes, deleting the empty list block set `prevBlock = null`, causing complete focus loss.
3. **Caret Overshoot During Block Merges with Formatted Markdown**:
   * When merging text into `prevBlock`, `setCaretAtOffset` was passed the raw Markdown string length (`prevContent.length`). Because Markdown syntax characters (`**`, `*`, `~~`, `==`, `$`) expand raw string length relative to rendered DOM text, the caret overshot past the merge junction and landed several characters into the joined text.
4. **Typing Cursor Reversion on Markdown Shortcuts**:
   * Typing markdown shortcuts (`- `, `* `, `1. `, `[ ] `) invoked `handleChangeType` which executed an asynchronous `sel.collapseToStart()`, forcing the caret to offset 0 while typing.
5. **Checked Task List Splitting Residue (`[x]` / `[X]`)**:
   * In `handleKeyDown`, the bullet cleanup regex `/^(\*|-|•|\d+\.|\[\s?\])\s+/` failed to match `[x]` or `[X]`, leaving literal `[x] ` markers inside the second block on split.
6. **Non-Deterministic Caret Placement on Line Splits**:
   * `handleAddAfter` invoked `focus()` without `setCaretToStart(el)`, leading to inconsistent caret placement in certain browser rendering cycles.
7. **Pasting Indented Markdown Lists**:
   * Bullet and number parsers checked `line.startsWith("- ")` without testing `trimmed`, causing indented sub-lists in pasted Markdown to fall back to plain text.

### Resolution & Architectural Enhancements
1. **Unified Backspace Un-Listing State Machine (`BlockNoteEditor.jsx`)**:
   * At offset 0 or when content is empty on any non-text block (`bullet`, `number`, `todo`, `toggle`, `h1`–`h4`, `quote`, `callout`), the first Backspace now converts the block to `"text"` (un-listing / outdenting it), preserving text content and focusing at offset 0.
   * A second Backspace on the resulting empty `"text"` block deletes the block and smoothly focuses the adjacent block (or stays on empty text if single block).
2. **DOM-Accurate Caret Junction Calculation on Merge**:
   * Calculates rendered DOM text length (`prevEl ? prevEl.textContent.length : prevContent.length`) before merging, ensuring the caret lands exactly at the seam between joined texts.
3. **Caret-Aware `handleChangeType` & Shortcut Handling**:
   * Updated `handleChangeType` to accept target caret positioning (`"start"` vs `"end"`), ensuring typing shortcuts with remaining text keeps the caret at the end of the typed word.
   * Added `[x] ` and `[X] ` shortcut support with `checked: true`.
4. **Complete Todo Marker Regex Sanitization**:
   * Updated regex to `/^(\*|-|•|\d+\.|\[[ xX]?\])\s+/`, cleanly stripping `[x]` and `[X]` task prefixes on Enter splits.
5. **Deterministic `setCaretToStart` on Spawned Blocks**:
   * Wrapped `handleAddAfter` focus in `requestAnimationFrame` + `setTimeout` with explicit `setCaretToStart(el)`.
6. **Indented Markdown List Parsing (`BlockNoteEditor.jsx` & `lib/exportImport.js`)**:
   * Updated `parseMarkdownToBlocks` and `tryParseMarkdownToBlocks` to match against `trimmed` line patterns.
7. **Automated Unit Verification**:
   * Added dedicated unit test suite in `tests/unit/note-persistence-flow.test.mjs` validating Backspace un-listing, checked todo marker cleanup, and caret positioning.

---

## 73. Sidebar NoteMenu React Portal Mounting & Dynamic Up/Down Viewport Auto-Flip

### Root Causes & Problem Statements
1. **Dropdown Overflow Clipping by Scroll Container**:
   * The sidebar note list has `overflow-y-auto`. Any traditional `absolute` dropdown rendered inside the list item was bounded by the scroll container's overflow or caused unwanted internal scrollbars.
2. **Bottom-Note Dropdown Viewport Cutoff**:
   * When opening the menu on notes situated near the bottom of the visible list or screen, the dropdown expanded downward past the bottom of the viewport, forcing the user to scroll down to view and interact with the actions.

### Resolution & Architectural Enhancements
1. **React Portal Root Mounting (`components/NoteMenu.jsx`)**:
   * Mounted the dropdown overlay directly to `document.body` via `createPortal`, completely freeing the menu from all parent `overflow: hidden` and `overflow: auto` clipping contexts.
   * Allowed the sidebar menu to comfortably pop out of the sidebar into the main canvas at a spacious `w-56` (224px) width without causing layout clipping or scrollbar distortion.
2. **Dynamic Up/Down Auto-Flip Orientation**:
   * Dynamically measures available viewport space (`spaceBelow = window.innerHeight - buttonRect.bottom` vs `spaceAbove = buttonRect.top`).
   * When space below is less than the menu's height (~280px for sidebar / ~380px for document) and space above is greater, the menu automatically opens **upwards** (`bottom = window.innerHeight - buttonTop + 6`), ensuring all menu options are immediately and fully visible on screen without any scrolling.
3. **Screen-Bounds Clamping**:
   * Clamped horizontal position (`Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))`) to prevent left/right screen boundary overflow.
4. **Verification**:
   * All 119 unit tests passing (`node --test tests/unit/*.test.mjs`).

---

## 74. Comprehensive Codebase Cleanup: Legacy Files, Dead Code, Unused Imports & Variables

### Root Causes & Problem Statements
1. **Legacy Architecture Bridges & Unused Files**:
   * `lib/blockMapping.js` and `scripts/check-block-mapping.mjs` were legacy serialization bridges from a pre-Dexie Supabase PostgreSQL architecture layer that was completely superseded by Dexie.js (`lib/db.js`, `lib/storageService.js`) and direct block storage.
2. **Unused Component & Library Imports**:
   * 23 files accumulated unused icon imports (`lucide-react`), unused React hooks (`useRef`, `useCallback`, `useState`, `useMemo`), and unused helper functions (`SPACES`, `getFaviconUrl`, `importBookmarksFromHtml`, `demoNotesBySpace`, etc.).
3. **Dead Local Variables & Unreferenced Helper Functions**:
   * Dead state and variables remained in several components, including `quizOpen` in `app/visualizations/page.jsx`, `domain` in `AddBookmarkModal.jsx`, `allNotes` and `flushSave` in `BlockNoteEditor.jsx`, `handleSaveSyllabus` in `Sidebar.jsx`, `acidHydroxyl` in `ChemistryCanvas.jsx`, `ROBO_JOINT`, `MovingConductor`, and `speed` in `PhysicsCanvas.jsx`, and `stateChanged` in `timerStore.js`.
4. **Obsolete In-Canvas HUD Components in 3D Scenes**:
   * `PinnedPanel`, `NOTE_STYLES`, and `VALUE_TONES` in `scene-kit.jsx` were legacy in-canvas HTML panels superseded by the unified 2D `VisualizationHUD.jsx`.

### Resolution & Codebase Optimization
1. **Eliminated Legacy Bridge Files**:
   * Deleted `lib/blockMapping.js` and `scripts/check-block-mapping.mjs`.
   * Removed legacy `BLOCK_TYPES` re-export from `lib/constants.js`.
   * Updated `package.json` test scripts to clean up obsolete checks.
2. **Purged All 23 Files of Unused Imports**:
   * Cleaned up all unused Lucide icons, React hooks, and unreferenced library imports across `app/`, `components/`, `lib/`, `hooks/`, `scripts/`, and `tests/`.
3. **Removed Dead Variables, Functions & Obsolete Styles**:
   * Removed dead state, unreferenced destructured parameters, and unused functions across `BlockNoteEditor.jsx`, `Sidebar.jsx`, `CalendarView.jsx`, `Workspace.jsx`, `PhysicsCanvas.jsx`, `ChemistryCanvas.jsx`, `scene-kit.jsx`, and `timerStore.js`.
4. **Automated Verification**:
   * AST static analysis confirmed 0 unused imports and 0 dead code occurrences across the entire repository.
   * All 190 unit, integration, and flow tests pass with 100% success rate (`npm test`).

---

## 75. Table Block Deep Scan: Markdown Parsing, HTML Ingestion, AI Extraction & Memory Isolation

### Root Causes & Problem Statements
1. **Markdown Table Ingestion Failure (Tables Without Outer Pipes)**:
   * `tryParseMarkdownToBlocks`, `tryParsePlainTextToBlocks`, and `parseMarkdownToBlocks` strictly enforced `trimmed.startsWith("|") && trimmed.includes("|")`.
   * Standard GitHub-flavored Markdown tables where leading/trailing pipes are omitted (e.g. `Col A | Col B\n--- | ---\n1 | 2`) failed table recognition and degraded into raw text blocks.
2. **Disabled AI Study Tools & Hidden Copy Button on Table Blocks**:
   * In `BlockMenuModal` (`BlockNoteEditor.jsx`), `blockText` was retrieved solely from `block.content || block.formula || block.details`. Because table blocks store data inside `tableData` while keeping `content: ""`, `blockText` resolved to `""`.
   * This disabled "✨ Explain" and "🦆 Quiz me" and hid the "📄 Copy Content" button on table blocks.
3. **Shallow Memory Mutation on Block & Note Duplication**:
   * In `handleDuplicateBlock` (`BlockNoteEditor.jsx`) and `handleDuplicateNote` (`Workspace.jsx`), blocks were cloned with shallow spread (`{ ...target, id: newId }`).
   * Duplicated table blocks shared the exact same nested `tableData.rows` and `tableData.headers` array instances, causing edits in a cloned table to mutate the original table in memory.
4. **Table Type Switching Edge Cases**:
   * In `handleChangeType` (`BlockNoteEditor.jsx`), converting a block to `"table"` did not initialize `tableData`, and attempted to focus a non-existent standard contentEditable node.
   * Converting from `"table"` to `"text"` discarded table rows since `content` was empty.
5. **HTML Table Import Header Duplication Without `<th>`**:
   * In `tryParseHTMLToBlocks` (both DOM and regex engines), if an HTML table omitted `<th>` headers, `headerCells` defaulted to `["Col 1", "Col 2"]` while keeping all `<tr>` rows (including row 0), duplicating row 0 as both a header placeholder and data row.
6. **Sparse Array Mutation in Cell Edits & Normalization Fallbacks**:
   * Editing non-adjacent row cells produced sparse arrays (`[val, <empty>, val2]`).
   * `getNormalizedTableData` did not recognize `columns`/`data` aliases and failed safe fallbacks when passed `{ headers: [], rows: [] }`.
7. **Plain Text AI Extraction Omission**:
   * `editorBlocksToText` in `lib/blocks.js` did not escape cell pipes, did not pad missing cells, and omitted the table's `title` caption.

### Resolution & Architectural Enhancements
1. **Universal Markdown & Plain Text Table Parsing**:
   * Updated `tryParseMarkdownToBlocks`, `tryParsePlainTextToBlocks`, and `parseMarkdownToBlocks` to detect tables on `trimmed.includes("|")` paired with table separator validation (`isSeparator = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/`).
2. **Dynamic AI & Clipboard Serialization for Table Blocks**:
   * `BlockMenuModal` now calculates `blockText` via `blockToMarkdown(block)`, enabling Explain, Quiz me, and Copy Content on all table blocks.
3. **Deep Isolation for Cloned Tables**:
   * Deep-cloned `tableData` and `meta` via `JSON.parse(JSON.stringify(...))` during block and note duplication.
4. **Bidirectional Type Switching & Focus Routing**:
   * Converting to `"table"` immediately populates `tableData` and focuses `tbl_${id}_h_0`.
   * Converting from `"table"` preserves all data by serializing to markdown text.
5. **HTML Ingestion Header Promotion**:
   * When `<th>` elements are absent, `tryParseHTMLToBlocks` now shifts `rows[0]` as the table headers.
6. **Dense Array Safety & Schema Aliases**:
   * `handleCellChange` guarantees dense array allocations (`while (newRow.length <= colIndex) newRow.push("")`).
   * `getNormalizedTableData` supports `columns`/`data` aliases and enforces non-empty fallback structures.
7. **Comprehensive Unit Testing Suite**:
   * Created [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) verifying all 14 table scenarios and edge cases.
   * Total test suite expanded to **204 passing tests** across 59 suites (`npm test`).

---

## 76. Table Cells: Interactive Inline LaTeX Equation Editing, Creation Popover & Keyboard Shortcuts

### Root Causes & Problem Statements
1. **Uneditable Inline Math Inside Table Cells**:
   * While `TableCell` rendered inline LaTeX pills (`.katex-inline-node`), clicking on any math pill inside a table cell failed to open the `InlineEquationPopover` because `TableCell` had an unconditional `onClick={(e) => e.stopPropagation()}` without checking for `.katex-inline-node` and `TableBlock` had no popover state handlers.
2. **Missing Equation Creation Tools Inside Tables**:
   * Users could not insert new equations into table cells through UI actions or keyboard shortcuts like in paragraph/text blocks.

### Resolution & Architectural Enhancements
1. **Interactive Math Pill Click Detection & Popover Binding**:
   * Updated `TableCell`'s `onClick` to intercept clicks on `.katex-inline-node` elements (`mathPill = e.target.closest(".katex-inline-node")`) and forward the event to `onMathClick(mathPill, cellEl, rowIdx, colIdx, isHeader)`.
   * Mounted `InlineEquationPopover` within `TableBlock` with complete Formula Presets (Fraction, Square Root, Integral, Derivative, etc.) and Quick Math Symbols (π, θ, α, β, ±, →, etc.).
2. **Lossless Inline Math Editing & Deletion**:
   * On popover save, `handleMathSave` renders the updated LaTeX via `renderKatexToStringMemoized`, updates `data-formula`, and serializes the new cell text into `tableData`.
   * On popover delete, `handleMathDelete` removes the target equation pill and persists the cell changes.
3. **Multiple Convenient Ways to Add Formulas to Table Cells**:
   * **Direct Typing**: Typing `$formula$` (e.g. `$E = mc^2$`) automatically converts to an interactive KaTeX pill on cell blur or navigation.
   * **Toolbar `ƒ(x) Formula` Button**: A dedicated `ƒ(x) Formula` button in the Table Top Toolbar inserts or opens the equation editor for the currently active/focused cell.
   * **Cell Hover `ƒ(x)` Quick Action**: A hover button on each table cell (`ƒ(x)`) allows one-click equation creation.
   * **Keyboard Shortcut (`Ctrl+M` / `Cmd+M`)**: Pressing `Ctrl+M` or `Cmd+M` while focused in any table cell opens the equation popover immediately.
4. **Automated Unit Testing**:
   * Added unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) verifying lossless round-tripping of LaTeX equations inside markdown table cells.
   * All 205 unit, integration, and flow tests pass (`npm test`).

---

## 77. Table Block: Column & Row Deletion / Addition Full Undo & Redo Integration

### Root Causes & Problem Statements
1. **Missing Undo/Redo Snapshots on Table Structural Actions**:
   * Deleting columns (`removeColumn`), deleting rows (`removeRow`), adding columns (`addColumn`), and adding rows (`addRow`) directly mutated the block state and persisted via `onUpdateBlock(block.id, { tableData: newData, content: "" }, true)`.
   * However, `handleUpdateBlock` did not snapshot the pre-mutation `blocksRef.current` into `pastBlocks`, leaving no history frame for `Ctrl+Z` / `Ctrl+Y` to restore deleted columns or rows.
2. **Shallow Pointer Hazards in History Stacks**:
   * When history stacks recorded `blocksRef.current`, nested `tableData.headers` and `tableData.rows` array pointers were shared by reference with live editor blocks, allowing in-place array operations to alter past history records.

### Resolution & Architectural Enhancements
1. **Explicit History Recording for Table Mutations**:
   * Updated `handleUpdateBlock` to accept a `recordHistory` flag.
   * Updated `removeColumn`, `removeRow`, `addColumn`, and `addRow` in `TableBlock` to pass `recordHistory = true`.
2. **Deep History Isolation & Immutability**:
   * Guaranteed deep cloning via `JSON.parse(JSON.stringify(blocksRef.current))` whenever snapshots are pushed to `pastBlocks` or `futureBlocks`.
   * Guaranteed deep cloning when restoring previous states on `Ctrl+Z` (Undo) and next states on `Ctrl+Y` / `Ctrl+Shift+Z` (Redo).
3. **Automated Unit Testing**:
   * Added state machine unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) verifying that column and row deletions are 100% losslessly undoable and redoable with all cell values preserved.
   * All 207 unit, integration, and flow tests pass (`npm test`).

---

## 78. Table Block: Inline Equation Deletion & Updating Race Condition Fix

### Root Causes & Problem Statements
1. **DOM Node Detachment on Blur Race Condition**:
   * When a user clicked the **Delete** button in `InlineEquationPopover`, the table cell blurred immediately.
   * `TableCell`'s `handleBlur` triggered `setBlockDOMFromText(cellRef.current, value || "")`, reconstructing all inner DOM children and detaching `selectedMathNode`.
   * When `handleMathDelete` subsequently called `selectedMathNode.remove()`, it removed an already-detached node, leaving the reconstructed cell DOM with the old formula intact.
   * `getBlockTextFromDOM(activeCellEl)` then re-read the old formula from the cell and wrote it back to `tableData`, causing the delete operation to fail silently.
2. **Missing History Registration on Formula Operations**:
   * Formula additions and deletions in table cells did not pass `recordHistory = true`, preventing undo/redo via `Ctrl+Z` / `Ctrl+Y`.

### Resolution & Architectural Enhancements
1. **Deterministic Text Pattern Replacement (`removeFormulaFromCellText`)**:
   * Implemented `removeFormulaFromCellText(currentCellText, formulaToDelete)` using regular expression matching (`\$\$?\s*formula\s*\$\$?`) to reliably strip the formula from the underlying text regardless of DOM blur timing.
   * Implemented `updateFormulaInCellText(currentCellText, oldFormula, newFormula)` to replace existing formula expressions cleanly.
2. **Synchronous Live DOM & State Synchronization**:
   * Directly updated `targetEl` with `setBlockDOMFromText(targetEl, newCellText)`.
   * Updated `tableData` and passed `recordHistory = true` to allow immediate Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).
3. **Automated Unit Testing**:
   * Added unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) validating `removeFormulaFromCellText` and `updateFormulaInCellText` across isolated formulas and formulas embedded in sentences.
   * All 209 unit, integration, and flow tests pass (`npm test`).

---

## 79. Floating Text Selection Popover Toolbar & Right-Click Context Menu Refactoring

### Feature Description & Requirements
1. **Contextual Floating Text Selection Toolbar**:
   * When any text is highlighted across any editable element in the editor (regular paragraphs, headings, lists, quotes, callouts, and table cells), a floating action toolbar appears positioned right above the highlighted selection range.
   * Actions provided:
     * **Bold** (`B`)
     * **Italic** (`I`)
     * **Underline** (`U`)
     * **Cross / Strikethrough** (`S`)
     * **Convert to Code** (`</>`) -> wraps selected text in backticks (`code`)
     * **Convert to Formula** (`$x$`) -> wraps selected text in math delimiters (`$formula$`)
     * **Explain with Socratic AI** (`✨ Explain`) -> invokes `onExplainBlock(selectedText)` to explain the selected passage
     * **Quiz me on Selection** (`🦆 Quiz me`) -> invokes `onQuizBlock(selectedText)` to generate a quiz from the selected passage
2. **Streamlined Right-Click Block Context Menu (`BlockContextMenu`)**:
   * Removed the redundant formatting toolbar buttons (`bold`, `italic`, `underline`, `strikethrough`, `math`) from the right-click menu.
   * Retained focused block-level actions: AI Study (Explain, Quiz me), Copy Content, Duplicate/Clone, Move Up, Move Down, Block Type Conversion, and Delete Block.

### Architectural Implementation
1. **`TextSelectionToolbar` in `components/BlockNoteEditor.jsx`**:
   * Tracks active DOM selections via `document.addEventListener("selectionchange")`, `scroll`, and `resize`.
   * Computes bounding rectangle via `range.getBoundingClientRect()` with viewport edge clamping and inverted bottom positioning when near top screen boundaries.
   * Uses `onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}` on all toolbar buttons to ensure clicking buttons does not collapse the active text selection.
   * Dispatches input events to the active `contentEditable` element to trigger synchronous markdown and table cell state serialization.
2. **Automated Unit Testing**:
   * Added unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) validating markdown selection wrapping and viewport edge clamping.
   * All 211 unit, integration, and flow tests pass (`npm test`).

---

## 80. Table Block: Exact Index-Targeted Formula Deletion with Duplicate Equation Isolation

### Root Causes & Problem Statements
1. **Global Regex Replacement Collateral Damage**:
   * When a table cell contained multiple copies of identical formulas (e.g. `"$x$ and $x$"` or `"Let $x$ be such that $x > 0$"`), clicking **Delete** or editing one specific formula used a global regex (`new RegExp(..., "g")`), which replaced/deleted all identical instances across the entire cell.
2. **Missing DOM Pill Index Correlation**:
   * The equation click handler only passed the clicked formula string, omitting the ordinal index of the clicked `.katex-inline-node` within the cell.

### Resolution & Architectural Enhancements
1. **Pill Ordinal Index Resolution (`activeFormulaIndex`)**:
   * Updated `handleMathClick` in `TableBlock` to calculate the exact index of the clicked pill using `Array.from(cellEl.querySelectorAll(".katex-inline-node")).indexOf(mathPill)`.
2. **Index-Targeted Replacement (`removeFormulaAtIndex` / `updateFormulaAtIndex`)**:
   * Implemented `removeFormulaAtIndex(text, targetIndex)` and `updateFormulaAtIndex(text, targetIndex, newFormula)` to scan formula tokens sequentially and delete or update strictly the target occurrence at `targetIndex`.
   * Provided fallback non-global single replacement (`new RegExp(...)` without `/g`) when index resolution is unavailable.
3. **Automated Unit Testing**:
   * Added unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) verifying that deleting a specific copy of a duplicate formula in cells with 2 or 3 identical equations leaves the remaining instances completely untouched.
   * All 212 unit, integration, and flow tests pass (`npm test`).

---

## 81. TextSelectionToolbar: Instant Inline Math & Code Compilation with Table Undo/Redo Synchronization

### Root Causes & Problem Statements
1. **Delayed Math and Code Compilation**:
   * When using **Convert to Formula** (`$x$`) or **Convert to Code** (`</>`) from the floating text selection toolbar, raw delimiters (`$formula$` or `` `code` ``) were inserted into the `contentEditable` DOM without triggering inline markdown compilation.
   * Users had to manually press Enter, Tab, or click away to force `setBlockDOMFromText` to run on blur.
2. **Missing History Snapshot on Toolbar Formatting in Tables**:
   * Toolbar formatting operations did not snapshot the pre-mutation state into `pastBlocks`.
   * Pressing `Ctrl+Z` after formatting text inside a table cell skipped the format action or corrupted the undo stack.

### Resolution & Architectural Enhancements
1. **Synchronous Immediate DOM Compilation**:
   * In `handleFormat` inside `TextSelectionToolbar`, immediately after inserting delimiters via `document.execCommand("insertText")`, `setBlockDOMFromText(activeEl, getBlockTextFromDOM(activeEl))` is called synchronously.
   * Inline equations compile instantly into interactive KaTeX math pills (`<span class="katex-inline-node" ...>`) and code snippets into styled `<code ...>` elements with zero latency.
2. **History Snapshot Integration (`recordHistorySnapshot`)**:
   * Created `recordHistorySnapshot` in `BlockNoteEditor` and passed it as `onRecordHistory` to `TextSelectionToolbar`.
   * Snapshots `blocksRef.current` (deep cloned) into `pastBlocks` before any formatting command executes, enabling instant, lossless `Ctrl+Z` / `Ctrl+Y` undo/redo across both regular blocks and table cells.
3. **Automated Unit Testing**:
   * Added unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) testing instant formula compilation and table history restoration.
   * All 213 unit, integration, and flow tests pass (`npm test`).

---

## 82. Typography Palette: 5 Custom Font Options with Notion-Style NoteMenu Typography Selector

### Feature Description & Architectural Enhancements
1. **5 Custom Academic & Creative Typography Families**:
   * **Default Sans** (`sans`): Ultra-clean, modern UI font (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
   * **Classic Serif** (`serif`): Scholarly textbook & editorial font (`'Lora', 'Charter', Georgia, 'Times New Roman', serif`).
   * **Developer Mono** (`mono`): Code & STEM derivation font (`'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`).
   * **Handwritten** (`handwriting`): Casual scholar notebook font (`'Caveat', 'Patrick Hand', 'Comic Sans MS', cursive`) with normalized visual scaling (`1.08em` font-size).
   * **Geometric Grotesk** (`geometric`): Modern stylized display sans (`'Plus Jakarta Sans', 'Outfit', 'Space Grotesk', system-ui, sans-serif`).
2. **Notion-Style Typography Selector (`NoteMenu.jsx`)**:
   * Mounted in in-note / document mode at the top of the `NoteMenu` dropdown.
   * Features a 5-button segmented grid displaying live preview glyphs (`Ag`), localized font family styling, active outline ring, and descriptive tooltips.
3. **Per-Note Typography Persistence**:
   * Persisted seamlessly in Dexie.js IndexedDB via `saveNote({ ...note, fontStyle })`.
   * Synced across note creation, note duplication, workspace export/import, and automatic unmount saves.
   * Enables each note to have its own independent font style (e.g. Physics in *Mono*, History in *Serif*, Reflection in *Handwriting*).
4. **Automated Unit Testing**:
   * Added unit tests in [`tests/unit/table-block.test.mjs`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/tests/unit/table-block.test.mjs) verifying font mapping, CSS class application, and multi-note style isolation.
   * All 215 unit, integration, and flow tests pass (`npm test`).

---

## 83. Font Style Not Applying After Click — `handleSaveNote` Dropped `fontStyle` from State

### Root Cause & Problem Statement
When a user selected a font in the `NoteMenu` typography picker, the font appeared to save ("✓ Saved locally") but the note's content font did not change visually.

**Root Cause**: `handleSaveNote` in `Workspace.jsx` assembled a `noteData` payload at lines 600–609 without ever reading `fontStyle` from the incoming `noteToSave`. This meant:
1. `notesBySpace` React state was updated **without** `fontStyle`, so `activeNoteObj.fontStyle` remained `undefined` after every save.
2. `BlockNoteEditor` was rendered with `initialFontStyle={activeNoteObj?.fontStyle || "sans"}` — which always resolved to `"sans"` since `fontStyle` was never in state.
3. The `useEffect` that syncs `initialFontStyle → setFontStyle(...)` never fired with a different value.

### Resolution
Added `updatedFontStyle` extraction alongside the other field extractions, and included `fontStyle: updatedFontStyle` in the `noteData` payload:
```js
const updatedFontStyle = noteToSave?.fontStyle !== undefined
  ? noteToSave.fontStyle
  : (activeNoteObj?.fontStyle || "sans");

const noteData = {
  ...
  fontStyle: updatedFontStyle,
  ...
};
```
This causes `setNotesBySpace(...)` to include `fontStyle` in `activeNoteObj`, which propagates to `initialFontStyle` prop in `BlockNoteEditor`, triggering the `useEffect` to update local `fontStyle` state and apply the correct `NOTE_FONT_CLASSES[fontStyle]` CSS class instantly.

---

## 84. Font Style Reset on Page Reload — `fontStyle` Stripped During IndexedDB Hydration

### Root Cause & Problem Statement
After the fix in §83, the font switched instantly on click but **reverted to Default on every page reload**. The font was correctly written to IndexedDB by `saveNote` (which includes `fontStyle`), but when the workspace loaded notes back on startup, the `fontStyle` field was silently dropped.

**Root Cause**: The `loadLocalWorkspace` hydration function in `Workspace.jsx` manually mapped each DB note into a new object with an explicit whitelist of fields (`id`, `title`, `space`, `spaceId`, `banner`, `emoji`, `isFavorite`, `order`, `blocks`) and **`fontStyle` was not in the whitelist** — so it was discarded when building `spaceMap`. The same issue existed in the `handleImportSuccess` hydration path.

### Resolution
Added `fontStyle: n.fontStyle || "sans"` to both note-mapping locations in `Workspace.jsx`:
1. **`loadLocalWorkspace` (startup hydration)** — line ~213
2. **`handleImportSuccess` (post-import reload)** — line ~831

Now `fontStyle` is preserved through the full round-trip: IndexedDB → `spaceMap` state → `activeNoteObj.fontStyle` → `initialFontStyle` prop → `BlockNoteEditor` CSS class.

---

## 85. In-Note Menu: "Full width" and "Lock page" Toggles & Read-Only Page Enforcement

### Feature Requirements & Problem Statements
1. **Full width Toggle**:
   - Notion-style toggle switch row placed inside the top-right In-Note Menu (`NoteMenu.jsx`) directly beneath "Move to Space".
   - Toggles the document canvas between standard reading width (`max-w-3xl px-10`) and full viewport width (`w-full max-w-none px-6 md:px-12`).
   - Must persist per-note across sessions and reloads without affecting other notes.
2. **Lock page Toggle & Strict Read-Only Mode**:
   - Notion-style toggle switch row placed inside the top-right In-Note Menu directly below "Full width".
   - Prevents accidental edits or mutations to published notes, specs, or finished study documents.
   - When locked:
      - Renders a subtle, non-intrusive lock icon button at the top-right corner of the note canvas (under the top bar) with an instant unlock click action and tooltip (`title="Page is locked to prevent edits. Click to unlock."`).
      - Note Title `<input>` is made `readOnly`.
      - Progressive disclosure action strip (Add Icon / Add Cover) and banner controls are hidden.
      - Note Emoji icon picker is disabled.
      - All note blocks (text, headings, lists, todos, toggles, callouts, quotes, dividers) have `contentEditable={false}`.
      - Left gutter drag handle `⠿` and delete button `🗑️` are hidden.
      - Right-click block context menu (`BlockContextMenu`) and slash menu (`/`) are disabled.
      - Sub-blocks (`TableBlock`, `CodeBlock`, `MathBlock`, `CanvasBlock`) become strictly read-only (disabling cell editing, formula editing, code editing, language changing, and column/row additions).
      - Persists per-note in Dexie IndexedDB via `isLocked: boolean`.

### Architectural Implementation & File Modifications
1. **`components/NoteMenu.jsx`**:
   - Imported `ArrowLeftRight` and `Lock` icons from `lucide-react`.
   - Added `fullWidth`, `isLocked`, `onToggleFullWidth`, `onToggleLockPage` props to `NoteMenu`.
   - Rendered dual interactive Notion-style switch rows with smooth slide-pill toggles directly beneath "Move to Space" in document mode (`!isSidebar`).
2. **`lib/storageService.js` & `lib/demoNotes.js` & `lib/exportImport.js`**:
   - Updated `saveNote` in `storageService.js` to persist `fullWidth: Boolean(note.fullWidth ?? false)` and `isLocked: Boolean(note.isLocked ?? false)`.
   - Included defaults in `demoNotes.js` and `exportImport.js` to ensure backward-compatible schema migration.
3. **`components/Workspace.jsx`**:
   - Added `fullWidth` and `isLocked` to `loadLocalWorkspace` and `handleImportSuccess` hydration mappings from IndexedDB.
   - Updated `handleSaveNote` to preserve and broadcast `updatedFullWidth` and `updatedIsLocked` in `spaceMap` state.
   - Wired `fullWidth`, `isLocked`, `onToggleFullWidth`, `onToggleLockPage` to `<NoteMenu ... />` and `initialFullWidth`, `initialLocked`, `onToggleLock` to `<BlockNoteEditor ... />`.
4. **`components/BlockNoteEditor.jsx`**:
   - Applied dynamic responsive container width: `fullWidth ? "w-full max-w-none px-6 md:px-12" : "max-w-3xl px-10"`.
   - Replaced intrusive text banner with a subtle top-right lock icon button (`absolute top-3 right-6 z-30`) with an amber indicator icon and tooltip.
   - Locked all editor blocks (`contentEditable={!isLocked}`), inputs (`readOnly={isLocked}`), dropdowns, and sub-block mutation mechanics.
5. **`tests/unit/table-block.test.mjs`**:
   - Added unit test suites verifying full width default fallback, full viewport resolution, per-note isolation, and lock permissions / read-only constraints.

---

## 86. NoteMenu "Last Edited" Always Showing "Just now"

### Root Cause & Problem Statement
The `formatLastEdited(timestamp)` function in `NoteMenu.jsx` correctly formats timestamps but returns `"Just now"` when `timestamp` is `null` or `undefined`. The real bug was upstream: **`updatedAt` and `createdAt` were never included in the note objects held in React state** (`notesBySpace` / `activeNoteObj`), so `note?.updatedAt` was always `undefined` when passed to `NoteMenu`.

Three hydration sites failed to include timestamp fields:
1. **`loadLocalWorkspace`** — the initial IndexedDB → `spaceMap` hydration loop explicitly whitelisted fields but excluded `updatedAt` and `createdAt`.
2. **`handleImportSuccess`** — same whitelist omission in the post-import re-hydration loop.
3. **`handleSaveNote`** — the `noteData` object built for both `setNotesBySpace` and `saveNote(noteData)` did not include `updatedAt`, so after every save React state got stale/undefined timestamps.
4. **`handleCreateNote`** — new notes were created without `createdAt` / `updatedAt`, causing them to always appear as "Just now".

### Resolution
- **`components/Workspace.jsx` — `loadLocalWorkspace`**: Added `createdAt: n.createdAt || null` and `updatedAt: n.updatedAt || n.createdAt || null` to the per-note objects pushed into `spaceMap`.
- **`components/Workspace.jsx` — `handleImportSuccess`**: Same fields added to the import re-hydration loop.
- **`components/Workspace.jsx` — `handleSaveNote`**: Added `const now = new Date().toISOString()` and included `createdAt` (preserved from existing note) and `updatedAt: now` in `noteData`. This ensures every save operation updates the React state timestamp correctly and `activeNoteObj.updatedAt` reflects the actual last save time.
- **`components/Workspace.jsx` — `handleCreateNote`**: Added `createdAt: now` and `updatedAt: now` to newly created note objects.

---

## 87. Multi-Format Note Export Engine Verification & Mammoth DOCX Buffer Compatibility

### Root Cause & Problem Statement
When running DOCX parser round-trips (`tryParseDocxToBlocks`) across different environments (Node.js vs Browser), `mammoth.convertToHtml` accepts `{ buffer: Buffer }` in Node.js runtime environments but expects `{ arrayBuffer: ArrayBuffer }` in Web browser DOM environments. Passing raw `ArrayBuffer` directly into `mammoth.convertToHtml` under Node.js runtime resulted in unhandled conversion errors.

### Resolution
- Updated `tryParseDocxToBlocks` in `lib/exportImport.js` to inspect `typeof Buffer !== "undefined"`.
- In Node.js environments, normalizes input buffers via `Buffer.isBuffer(input) ? input : Buffer.from(input)`.
- In Browser environments, cleanly passes `{ arrayBuffer: input }`.

---

## 88. Rich Native Blocks (`site`, `media`, `canvas`) Export Preservation

### Root Cause & Problem Statement
Previously, `filterBlocksForExport` in `lib/exportImport.js` prematurely flattened `site`, `media`, and `canvas` blocks into generic `type: "text"` strings (`"[Canvas] – ..."`, `"[Image] ..."`). As a consequence:
1. Standalone HTML exporter (`blocksToHTMLLossy`) bypassed rich bookmark cards (with 🌐 icon, title, and link) and native media containers (images with captions, audio and video players).
2. Markdown exporter (`blocksToMarkdownLossy`) serialized raw plain text instead of standard Markdown hyperlinks `[title](url)` and image tags `![caption](url)`.
3. Microsoft Word exporter (`blocksToDocxBlob`) output plain text paragraphs rather than styled link runs with 🌐 icons and media type badges (🖼️/🎵/🎬).
4. Plain text exporter (`blocksToPlainText`) lacked structured semantic tags (`[LINK: ...]`, `[IMAGE]`, `[CANVAS]`).

### Resolution & Visual Validation
1. **`lib/exportImport.js` — `filterBlocksForExport`**:
   - Preserves `type: "canvas"`, `type: "site"`, and `type: "media"` blocks with complete metadata (`url`, `title`, `content`, `mediaKind`).
2. **`lib/exportImport.js` — Exporters**:
   - **Markdown (`blocksToMarkdownLossy`)**: Added explicit cases for `site` (`[title](url)`), `media` (`![caption](url)`), and `canvas` (`[Canvas] – title`).
   - **HTML (`blockToHtmlFragment`)**: Added dedicated `canvas` badge container (`🎨 [Canvas Drawing]`) with dashed border and dark aesthetic matching the Socratic dark theme.
   - **DOCX (`blocksToDocxBlob`)**: Added formatted paragraph handlers with blue link runs and icon badges for site bookmarks, media blocks, and canvas whiteboard drawings.
   - **Plain Text (`blocksToPlainText`)**: Added clean tags (`[LINK: title] url`, `[IMAGE] content – url`, `[CANVAS] title`).
3. **Automated DevTools CDP Visual Accuracy Test Suite (`scripts/cdp_visual_tester.mjs`)**:
   - Built a comprehensive 29-block demo note (`Quantum Mechanics & Wave-Particle Duality Master Class`) exercising all 19 supported block types (`h1`, `h2`, `h3`, `h4`, `text` with inline math & styling, `bullet`, `number`, `todo`, `toggle`, `callout`, `quote`, `divider`, `code`, `math`, `inlinemath`, `table`, `site`, `media`, `canvas`).
   - Automated Headless Chrome over WebSocket CDP to load exported HTML, verify KaTeX auto-render (25 equations), capture full-page high-resolution screenshot (`html_visual_render.png`), and generate print PDF (`quantum_note.pdf`).
   - Visually verified dark theme styling, KaTeX gold formula rendering, Python syntax highlighting (pink keywords, cyan functions, yellow numbers), toggle collapsible details, interactive table formatting, checkable todos, and bookmark cards.

---

## 89. YouTube Video Embed & Google Docs / Web Rich HTML Smart Paste Sanitizer

### Root Cause & Problem Statement
1. **YouTube Video Playback Failure in Notes**:
   When users pasted a YouTube link (`youtube.com/watch?v=...`, `youtu.be/...`, or `youtube.com/shorts/...`) into a `media` block, the component rendered a standard HTML5 `<video src="...">` tag. Browsers cannot decode YouTube webpage URLs inside native `<video>` elements, triggering an immediate `onError` event and rendering the block unusable.
2. **Loss of Structure When Pasting from Google Docs, Lecture Slides, and Web Pages**:
   Previously, `handleSmartPaste` only extracted `text/plain` from the clipboard. When students copied rich notes from Google Docs or educational web portals, all headings, bold/italic annotations, bullet hierarchies, tables, and links were stripped to flat plain text. Conversely, unvetted rich HTML paste in contentEditable risked injecting Google Docs container markup (`<b id="docs-internal-guid-...">`) and hundreds of foreign inline CSS styles that corrupted the dark theme.

### Resolution & Implementation
1. **YouTube Embed Engine (`getYouTubeEmbedInfo`)**:
   - Implemented `getYouTubeEmbedInfo(url)` across `components/BlockNoteEditor.jsx` and `lib/exportImport.js`.
   - Parses watch URLs, shorts, embed URLs, shortlinks (`youtu.be`), and timestamps (`?t=120s`, `?start=90`).
   - Converts links to privacy-enhanced `https://www.youtube-nocookie.com/embed/VIDEO_ID` players.
   - Updated `MediaBlock` to auto-detect YouTube URLs, render a responsive 16:9 aspect-ratio iframe player (`aspect-video`), provide editable captions, and support direct `/youtube` slash menu filtering.
   - Updated HTML and Markdown exporters (`blocksToHTMLLossy`, `blocksToMarkdownLossy`, `exportNoteToDocx`) to cleanly export responsive YouTube iframes and markdown video links.
2. **Google Docs & Web Rich HTML Smart Paste Sanitizer (`parseHtmlToBlocks`)**:
   - Implemented an AST DOM transformer that intercepts `e.clipboardData.getData("text/html")`.
   - Unwraps Google Docs boilerplate (`docs-internal-guid-`, normal font-weight outer wrappers).
   - Maps semantic HTML elements directly to native SocraticOS blocks:
     - `<h1>`–`<h6>` &rarr; `h1`–`h4`
     - `<ul>` / `<ol>` / `<li>` &rarr; `bullet`, `number`, `todo`
     - `<table>` &rarr; interactive SocraticOS `table` blocks
     - `<blockquote>` &rarr; `quote` / `callout`
     - `<pre>`, `<code>` &rarr; `code`
     - `<iframe>` &rarr; `media` (YouTube embed)
   - Converts inline tags and Google Docs span styling (`<b>`, `<strong>`, `font-weight: 700`, `<i>`, `<em>`, `font-style: italic`, `<code>`, `<a>`, `<mark>`, `<s>`) into clean inline Markdown tokens (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`) without any DOM corruption or foreign style pollution.

---

## 90. Inline Media Resize Presets, Keyboard Navigation History & Notion-Style Right-Side Outline

### Root Cause & Problem Statement
1. **Diagrams and Media Taking Up Excessive Vertical and Horizontal Space**:
   Previously, all media blocks (Images, Videos, and YouTube players) rendered at 100% width. When embedding formula snapshots, compact diagrams, or reference videos alongside explanatory text, large full-width elements disrupted visual text flow.
2. **Lack of Fast Note History Traversal**:
   Users navigating complex note hierarchies across different spaces had no back/forward mechanism, requiring manual clicks in the sidebar tree or command palette each time they wanted to revisit their previous note.
3. **Difficulty Scanning Long Revision Guides & Clunky In-Page TOC Blocks**:
   Long revision guides with multiple sections lacked a convenient bird's-eye view. Placing an in-page TOC block inside the document body occupied vertical reading space and disrupted text flow compared to Notion's right-side outline.

### Resolution & Implementation
1. **Inline Media Resize Presets (`25%` / `50%` / `100%`)**:
   - Added segmented width toggle pills (`25%`, `50%`, `100%`) to `MediaBlock` header in `components/BlockNoteEditor.jsx`.
   - Constrains container widths proportionally (`w-full max-w-[25%] min-w-[220px] mx-auto`, `w-full max-w-[50%] min-w-[320px] mx-auto`, `w-full`) for balanced layout with text flow.
   - Sizing settings persist per-block in IndexedDB and export cleanly to HTML and Markdown.
2. **In-Memory Keyboard Navigation History (`Alt + ←` / `Alt + →`)**:
   - Implemented `navHistoryRef` (history stack of `{ noteId, spaceName }`), `historyIndexRef`, and `pushNavHistory` in `components/Workspace.jsx`.
   - Listens for global `Alt + ArrowLeft` (History Back) and `Alt + ArrowRight` (History Forward) shortcuts.
   - Added visual `◀` and `▶` breadcrumb navigation buttons in the top navigation bar with disabled state reflection and shortcut tooltips.
3. **Notion-Style Right-Side Outline (Table of Contents)**:
   - Removed in-page `toc` block type to keep document content clean and focused across 19 native block types.
   - Built a sleek, glassmorphic right-side Outline (`fixed top-20 right-4 lg:right-6`) in `BlockNoteEditor.jsx` with collapsible `📑 Outline (N)` toggle pill and collapsible panel.
   - Live Heading Extraction: Dynamically scans active note `h1`, `h2`, `h3`, `h4` headings with hierarchical indentation (`H1`: pl-1, `H2`: pl-3, `H3`: pl-5, `H4`: pl-7).
   - Scroll-Spy Active Tracking: Tracks viewport scroll position and highlights the section currently in reading focus (`border-l-2 border-duck-400 bg-duck-500/15`).
   - One-Click Jump: Clicking any outline section smoothly scrolls the editor viewport directly to the heading, focuses it, and triggers a pulse highlight ring (`ring-2 ring-duck-400 bg-duck-500/10`).

---

## 91. Multi-Column Layout Block (2 to 5 Columns Split) & Notion Outline Refinements

### Root Cause & Problem Statement
1. **Lack of Native Side-by-Side Concept Comparison Layouts**:
   Students creating comparative notes (*Mitosis vs. Meiosis*, *Conductors vs. Insulators*, *Pros vs. Cons*, *Cornell Notes*) previously had to rely on 2D table blocks. Tables enforced grid rows rather than independent, flexible multi-line columns with titles and body formatting.
2. **Multi-Column Flexibility**:
   Students and educators needed the ability to split layouts into 2, 3, 4, or 5 columns on demand, with responsive fallback stacking on mobile viewports.

### Resolution & Implementation
1. **Block Drag & Drop Reordering Fix**:
   - Fixed missing `draggable={!isLocked}`, `onDragStart`, `onDragEnd` on block `⠿` grip handles in `EditorBlock`.
   - Wired `onDragOver` and `onDrop` handlers to `EditorBlock` container with visual target drop indicators.
   - Updated `dragHandlers.onDrop` to smoothly reorder blocks and trigger auto-save.
2. **Multi-Column Layout Block (`columns`) & Slash Menu Autocomplete**:
   - Removed outer box wrapper and header buttons for a clean, borderless Notion-style column layout.
   - Converted column title and body to rich `contentEditable` containers with live KaTeX formula (`$formula$`) and inline code (`` `code` ``) compilation.
   - Added dedicated `/2 columns`, `/3 columns`, `/4 columns`, `/5 columns` items in `SlashMenu` so typing `/2`, `/3`, `/4`, `/5`, `/col`, `/split`, or `/compare` allows instant selection of the split count.
3. **Notion Minimap Ticks & Outline Refinements**:
   - Made each minimap tick individually clickable with instant scroll jump to target heading.
   - Maintained active section white glow and hover/pin outline drawer.

---

## 92. Split Columns: Inline Equation Popover Editor & Code Typing Caret Fix

### Root Cause & Problem Statement
1. **Uneditable Inline Math Pills Inside Columns**:
   Clicking on an inline math pill (`$formula$`) inside a column card previously did not trigger the `InlineEquationPopover`. Users could view the rendered KaTeX formula pill, but had no way to edit or delete it via interactive popover.
2. **Caret Reset / Focus Loss While Typing Code Syntax**:
   In `ColumnItem`, `useEffect` synchronized DOM content on every state update, calling `setBlockDOMFromText` and resetting `innerHTML` while the user was actively typing backtick code syntax (`` `code` ``). This destroyed active caret selection and caused typing glitches.

### Resolution & Architectural Enhancements
1. **Interactive Inline Equation Popover in Columns**:
   - Wired `onMathClick` on both column title and multi-line body containers in `ColumnItem`.
   - Integrated `InlineEquationPopover` positioned directly above the column grid in `ColumnsBlock`.
   - Supported live equation modifications, formula replacement (`updateFormulaInCellText`), and formula deletion (`removeFormulaFromCellText`) with automatic state persistence.
2. **Active Element Hydration Guard for Caret Stability**:
   - Guarded `setBlockDOMFromText` in `ColumnItem`'s `useEffect` with `document.activeElement !== ref.current`, ensuring live typing of backtick code snippets (`` `x` ``) and math formulas progresses smoothly without resetting the browser cursor.
   - Deferred formatting to `onBlur`, creating a flicker-free typing experience matching `TableCell` and `EditorBlock`.

---

## 93. Code Block Architecture & Inline Backtick (`x`) Caret Boundary Handling

### Root Cause & Problem Statement
1. **Caret Trapping in Inline Code (`<code>`) Across All Blocks**:
   When an inline code snippet (`` `x` ``) was rendered in `contentEditable` containers (paragraphs, headings, lists, quotes, callouts, toggles, table cells, split columns), the browser's caret would become trapped inside the `<code>` DOM node. Users were unable to easily step outside the code element to type text *before* or *after* the code tag without the typed characters being sucked inside `<code>`.
2. **Invisible / Unresponsive Text in Standalone Code Block**:
   In `CodeBlock`, the textarea had `color: "transparent"` overlaid on top of a syntax highlight underlay div. Discrepancies in font metrics, padding, line heights, or scroll offsets rendered text invisible or disconnected from the caret. Furthermore, `onChange` called `onUpdateBlock` with synchronous save on every keystroke, causing severe typing lag.
3. **Missing Auto-Focus on Code Block Creation**:
   When creating a code block via shortcut ```` ``` ```` or slash command `/code`, focus was not transferred to the code editor textarea.

### Resolution & Architectural Enhancements
1. **Inline Code (`<code>`) Boundary Caret Navigation (`handleInlineBoundaryKeyDown`)**:
   - Implemented `handleInlineBoundaryKeyDown` across `EditorBlock`, `TableCell`, and `ColumnItem`.
   - Pressing `ArrowRight` at the end of an inline `<code>` tag smoothly escapes the tag into a trailing text node, allowing immediate typing of text *after* the code block.
   - Pressing `ArrowLeft` at the start of an inline `<code>` tag smoothly escapes the tag into a leading text node, allowing immediate typing of text *before* the code block.
   - In `setBlockDOMFromText`, guaranteed that boundary text nodes (`document.createTextNode("")`) exist around element nodes, ensuring clean click targets before and after code pills.
2. **Rock-Solid Standalone Code Block (`CodeBlock`)**:
   - Replaced fragile transparent overlay with a high-contrast, crystal-clear monospaced code editor (`text-emerald-300 bg-[#0d1017] font-mono leading-relaxed`).
   - Added a synchronized line numbers gutter (`1, 2, 3...`) matching code line count.
   - Added 2-space `Tab` and `Shift+Tab` indent/dedent support.
   - Added smart auto-indentation on `Enter` (inherits leading indentation from the previous line).
   - Added backspace on empty code block deletion.
   - Registered focus refs (`registerRef`) and wired immediate auto-focus in `handleChangeType` and `handleAddAfter`.
   - Converted keystroke updates to debounced save (`shouldSaveNote = false`), eliminating typing stutter.

---

## 94. Live Notion-Style Backtick Auto-Formatting & Table/Column Caret Trapping Fix

### Root Cause & Problem Statement
1. **Unformatted Backticks While Actively Typing in Tables and Column Split Blocks**:
   When typing inline code (` `x` `) inside `TableCell` or `ColumnItem`, the backtick pair remained as raw plain text until the element blurred. Once converted to `<code>x</code>` on blur, users clicking back into the cell/column were trapped inside `<code>` with no way to exit to normal text.
2. **Caret Inability to Exit Code Area to Normal Text**:
   When a user was typing inside or at the end of an inline `<code>` tag, pressing `Space` or `ArrowRight` was intercepted by the browser as characters *inside* the `<code>` element, expanding the code pill rather than exiting to standard paragraph/cell text.

### Resolution & Architectural Enhancements
1. **Live Notion-Style Backtick Auto-Compilation (`tryAutoFormatInlineCode`)**:
   - Implemented `tryAutoFormatInlineCode` and wired it into `handleInput` across `EditorBlock`, `TableCell` (headers and cells), and `ColumnItem` (titles and content).
   - The instant a user types a closing backtick (e.g. ` `code` `), the matched range immediately compiles into a styled `<code>` tag followed by a trailing text node with a space (`" "`).
   - The selection caret is placed at offset 1 in the trailing text node in normal text, allowing users to type normal text immediately after the code pill without being sucked into the code tag.
2. **Interactive Space and Arrow Boundary Exiting**:
   - In `handleInlineBoundaryKeyDown`, pressing `Space` at the end of `<code>` exits the code tag, appends a space in normal text, and advances the caret.
   - Pressing `ArrowRight` or `ArrowLeft` smoothly moves between normal text and code without DOM corruption.

---

## 95. End-of-Block Caret Placement & Unified `Enter` New Block Creation Across All Block Types

### Root Cause & Problem Statement
1. **Missing Keyboard/Caret Creation of New Lines in Non-Text Blocks**:
   In non-standard block types (`code`, `math`, `table`, `columns`, `site`, `media`, `canvas`, `toggle`), pressing `Enter` or clicking near the bottom/end of the block did not allow users to spawn a new standard text line/block underneath without manually finding and clicking a floating `+` button.
2. **Missing Caret Placement When Clicking Line Margins**:
   Clicking on the right-hand whitespace of a line container in paragraphs, headings, and lists previously did not reliably delegate focus to `setCaretToEnd(contentRef.current)`, making it awkward for users to position their cursor at the end of a line and press `Enter`.

### Resolution & Architectural Enhancements
1. **Unified Keyboard Exit & `onAddAfter` Integration Across All 20 Blocks**:
   - **`CodeBlock`**: Pressing `Shift+Enter`, `Ctrl+Enter`, or `Cmd+Enter` inside the code editor, or `Enter` on the code card container, creates a new paragraph block underneath.
   - **`TableBlock`**: Pressing `Shift+Enter`, `Ctrl+Enter`, or `Cmd+Enter` inside any table cell, or `Enter` on the table root container, creates a new block underneath.
   - **`ColumnsBlock` / `ColumnItem`**: Pressing `Shift+Enter`, `Ctrl+Enter`, or `Cmd+Enter` inside any column title or body, or `Enter` on the column split container, creates a new block underneath.
   - **`MathBlock`**: Pressing `Shift+Enter`, `Ctrl+Enter`, or `Cmd+Enter` while editing formulas, or `Enter` when the math container is selected, creates a new block underneath.
   - **`ToggleBlock`**: Pressing `Shift+Enter` or `Ctrl+Enter` inside the collapsible details textarea creates a new block underneath.
   - **`SiteBlock`, `MediaBlock`, `CanvasBlock`, `Divider`**: Pressing `Enter` on any selected card/block immediately creates a new paragraph block below.
2. **End-of-Block Caret Delegation on Row Whitespace Click**:
   - In `EditorBlock`, clicking anywhere in the empty right-hand whitespace of a block row automatically executes `setCaretToEnd(contentRef.current)`, placing the cursor at the end of the text so pressing `Enter` immediately creates a newline below.

---

## 96. Natural Arrow Key Block Exiting & Direct Outside-Box Click-to-Insert

### Root Cause & Problem Statement
1. **Unnatural `Shift+Enter` / `Ctrl+Enter` Requirement**:
   Forcing users to remember `Shift+Enter` or `Ctrl+Enter` to exit non-text blocks (`CodeBlock`, `TableBlock`, `ColumnsBlock`, `MathBlock`, `ToggleBlock`) was unintuitive and broke standard text editing workflow.
2. **Missing Arrow Navigation Across Complex Block Boundaries**:
   Pressing `ArrowDown` at the bottom of a code editor, on the last row of a table, at the end of a column body, or on a math equation was trapped inside the component rather than stepping cleanly into the next block or creating a new line underneath.
3. **No Direct Insertion Zone Below Blocks**:
   Clicking directly below or outside the bounding box of a card block did not position a caret directly underneath the block.

### Resolution & Architectural Enhancements
1. **Fluid Arrow Down / Arrow Up Navigation Across All Blocks (`handleExitDown` & `handleExitUp`)**:
   - **`CodeBlock`**: Pressing `ArrowDown` on the last line automatically exits the code block into the block below (or creates an empty text line with a blinking caret if at the end of the note). Pressing `ArrowUp` on the first line moves to the previous block.
   - **`TableBlock`**: Pressing `ArrowDown` in any cell of the last table row smoothly steps the caret out of the table into the line below (or creates a new text line). Pressing `ArrowUp` on the header row steps out to the line above.
   - **`ColumnsBlock` / `ColumnItem`**: Pressing `ArrowDown` at the end of any column text exits the multi-column split into the line below. Pressing `ArrowUp` at the start of column title moves to the line above.
   - **`MathBlock`**: Pressing `ArrowDown` steps into the line below. Pressing `ArrowUp` moves to the line above.
   - **`ToggleBlock`**: Pressing `ArrowDown` on the last line of the details textarea exits into the block below.
   - **`SiteBlock`, `MediaBlock`, `CanvasBlock`, `Divider`**: Pressing `ArrowDown` or `ArrowUp` navigates seamlessly to the adjacent blocks.
2. **Direct Outside-Box Click-to-Insert Dropzone**:
   - Added an interactive insertion dropzone beneath every block card. Clicking right outside/below any block immediately creates an empty text line with the caret focused, allowing the user to press standard `Enter` or start typing immediately without remembering any modifier shortcuts.

---

## 97. Milestone 1: Notion-Grade Navigation & Inline Math Interaction (F1, F2, F3)

### Root Cause & Problem Statement
1. **KaTeX Rendered Subtree Leakage in Range Calculations**:
   - Inline KaTeX pills (`<span class="katex-inline-node" contenteditable="false">`) contain nested DOM subtrees (`.katex-html`, MathML).
   - Standard DOM `preCaretRange.toString()` or `TreeWalker` operations counted internal rendered text, causing `preCaretRange.toString().length === 0` boundary checks to fail when navigating with `ArrowUp` or `ArrowDown`, trapping the caret within blocks.
2. **Missing Boundary Stepping & Traversal in `handleInlineBoundaryKeyDown`**:
   - `handleInlineBoundaryKeyDown` only contained logic for `<code>` elements. It lacked handlers for `.katex-inline-node`, causing `ArrowLeft`, `ArrowRight`, `Backspace`, and `Delete` to trap or drop characters on the wrong side of formula pills.
3. **Caret Start/End Inversion with Math Pills**:
   - `setCaretToStart` and `setCaretToEnd` filtered out KaTeX text nodes; when a block started or ended with `$formula$`, `setCaretToStart` positioned the cursor after the pill and `setCaretToEnd` positioned it before the pill.
4. **Missing Live Inline Math Auto-Compilation**:
   - Unlike inline code (which supported auto-compilation on backtick closure), typing `$formula$` did not auto-compile into an interactive KaTeX pill on typing the closing `$`.
5. **Backspace Merge Caret Overshooting**:
   - Caret offset during line merge computed `prevEl.textContent.length`, which included internal KaTeX DOM text (often 30–50 chars) rather than the true serialized markdown offset, causing the cursor to jump tens of characters forward into the merged text.

### Resolution & Architectural Enhancements
1. **Visual Line & Serialized Boundary Detection Helpers (`lib/editorCaret.js`)**:
   - Implemented `isCaretAtLogicalStart`, `isCaretAtLogicalEnd`, `isCaretAtBlockStart`, `isCaretAtBlockEnd`, `isCaretOnFirstVisualLine`, and `isCaretOnLastVisualLine`.
   - Used `getSerializedTextFromRange` and `cleanZeroWidth` to accurately compute offsets and boundaries ignoring internal KaTeX DOM subtrees.
2. **Inline Math Pill Stepping & Atomic Deletion (`handleInlineBoundaryKeyDown`)**:
   - Added bidirectional traversal across `.katex-inline-node` for `ArrowLeft` (stepping before the pill) and `ArrowRight` (stepping after the pill).
   - Added atomic deletion for `Backspace` (when immediately after a pill) and `Delete` (when immediately before a pill).
   - Ensured empty text nodes are created adjacent to pills so subsequent typing flows smoothly into text nodes rather than getting swallowed or trapped inside `contenteditable="false"`.
3. **Robust Start/End Anchoring (`setCaretToStart`, `setCaretToEnd`, `setCaretAtOffset`)**:
   - Automatically ensures boundary text nodes exist before leading pills and after trailing pills, eliminating caret start/end inversion.
   - Updated `setCaretAtOffset` to anchor ranges into adjacent text nodes around math pills.
4. **Live Inline Math Auto-Compilation (`tryAutoFormatInlineMath`)**:
   - Implemented regex pattern matching `/\$([^\s$](?:[^$\n]*[^\s$])?)\$$/` to compile `$formula$` on closing `$` delimiter.
   - Integrated `tryAutoFormatInlineMath` across `EditorBlock`, `TableCell`, and `ColumnItem` `handleInput` handlers.
5. **Symmetric Backspace Merge Offset Calculation**:
   - Replaced `prevEl.textContent.length` with `getDOMCaretLength(prevEl)` in `handleKeyDown`, ensuring the caret lands exactly at the join point between merged lines.

---

## 98. Milestones 2 & 3: Clean Enter Line Splitting, Backspace Merging, Whitespace Focus & Clean Persistence (F4, F5, F6, F7)

### Root Cause & Problem Statement
1. **Enter Line Splitting (F4)**:
   - Pressing `Enter` in the middle of a text, heading, list, or quote block could drop words, duplicate list markers (e.g. `- `, `1. `, `[ ]`), or leak raw markdown syntax into block content.
   - Spawning a new todo list block from a checked todo block retained `checked: true` rather than starting unchecked.
2. **Backspace Merging & Exact Caret Placement (F5)**:
   - Pressing `Backspace` at offset 0 of a block to merge into a previous block containing inline math pills (`$x$`), bold text, or code spans measured character offsets using `prevEl.textContent.length`.
   - `textContent` reads internal KaTeX DOM text (often 30–60 characters), causing the caret to overshoot past the join point and land deep inside the merged text.
3. **Bottom Whitespace Click Focus (F6)**:
   - Clicking empty whitespace below the document root created duplicate empty blocks instead of placing focus at the end of the last existing text block via `setCaretToEnd(el)`.
4. **Zero-Width Character Leaks & Storage Corruption (F7)**:
   - Browser contenteditable boundary insertions, clipboard copy-pasting, or intermediate markdown tokens leaked zero-width spaces (`\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF`, `\u0000`) into `block.content`.
   - Invisible characters accumulated in IndexedDB, corrupting heading search, AI context extraction (`editorBlocksToText`), and document file exports (Markdown, HTML, PlainText, DOCX).

### Resolution & Architectural Enhancements
1. **Clean Enter Line Splitting (`components/BlockNoteEditor.jsx`)**:
   - `splitBlockDOMAtRange` extracts `beforeRange` and `afterRange` content, updating the current block synchronously via `setBlockDOMFromText` and spawning the new block via `onAddAfter`.
   - Heading (`h1`–`h4`), `quote`, and `callout` blocks cleanly spawn standard `text` paragraph blocks below.
   - List blocks (`bullet`, `number`, `todo`, `toggle`) inherit list types, strip redundant leading markers (`replace(/^(\*|-|\u2022|\d+\.|\[[ xX]?\])\s+/, "")`), and reset todo checklist state (`checked: false`).
2. **Backspace Merging & Exact Caret Placement (`components/BlockNoteEditor.jsx`)**:
   - Integrated `isCaretAtLogicalStart(el)` and `cleanZeroWidth` into the Backspace boundary detector.
   - Used `getDOMCaretLength(prevEl)` to measure exact DOM caret offset prior to merging, synchronously formatted target DOM with `setBlockDOMFromText`, and placed caret at exact merge point with `setCaretAtOffset(targetEl, domCaretOffset)`.
3. **Bottom Whitespace Click Focus (`components/BlockNoteEditor.jsx:handleGlobalMouseUp`)**:
   - Updated global mouseup handler: clicking blank whitespace below the document focuses the last text-like block at the end of text via `setCaretToEnd(el)` without creating unwanted redundant blocks.
4. **Clean Persistence & Multi-Layer Zero-Width Sanitization**:
   - `cleanZeroWidth`: Robust sanitizer stripping `[\u200B\u200C\u200D\u2060\uFEFF\u0000]`.
   - **DOM Serializer (`lib/editorCaret.js:getBlockTextFromDOM`)**: Sanitizes all text nodes and returned AST strings.
   - **Storage Layer (`lib/storageService.js:saveNote`)**: Sanitizes note title, block contents, titles, details, formulas, captions, table matrices, and multi-column data before writing to Dexie IndexedDB.
   - **AI Context & Heading Serializer (`lib/blocks.js:editorBlocksToText`, `extractHeadingsFromBlocks`)**: Ensures prompt text and heading search remain free of zero-width artifacts.
   - **Export Engine (`lib/exportImport.js:filterBlocksForExport`)**: Sanitizes blocks across all Markdown, HTML, PlainText, and DOCX exports.

---

## 99. Group 1: Global Cross-Block Routing & Focus Foundation (BUG-REF-28, BUG-EXIT-14, BUG-EXIT-17, BUG-TYPE-26, BUG-DEL-23)

### Problem Statement
1. **Ref Registration Race & Overwrite (`BUG-REF-28`)**:
   - In `EditorBlock.jsx`, child `useEffect` hooks run before parent hooks.
   - Specialized blocks (`code`, `table`, `math`, `columns`, `site`, `media`, `canvas`) either registered their own refs or didn't mount `contentRef`.
   - Parent `EditorBlock` ran its `useEffect` afterwards and unconditionally called `registerRef(block.id, contentRef)`.
   - Since `contentRef.current` was `null` for non-standard blocks, it wiped child refs with `null`, breaking all downstream caret operations.
2. **Silent Focus Loss on Down/Up Exits into Specialized Blocks (`BUG-EXIT-14`)**:
   - `handleExitDown` and `handleExitUp` only checked `if (nextEl) setCaretToStart(nextEl)` with fallbacks only for `code` and `table`.
   - Transitioning with vertical arrows into `math`, `columns`, `site`, `media`, or `canvas` blocks dropped focus completely into `document.body`.
3. **Horizontal Navigation Wall at Block Ends (`BUG-EXIT-17`)**:
   - `handleKeyDown` for `ArrowRight` only checked `if (nextEl) setCaretToStart(nextEl)`.
   - Pressing `ArrowRight` at the end of a block preceding a non-text block hit an invisible wall and did nothing.
4. **Slash Command Focus Drop (`BUG-TYPE-26`)**:
   - Transforming a block to `columns` or `math` via slash commands dropped focus, forcing users to click with the mouse.
5. **Focus Loss on Empty Block Backspace (`BUG-DEL-23`)**:
   - Deleting an empty text block below `code`, `math`, `table`, or `columns` attempted to focus `blockRefs.current[prevBlock.id]?.current`, which was `null`, dropping focus to `document.body`.

### Resolution & Architectural Enhancements
1. **Ref Registration Guard (`components/BlockNoteEditor.jsx:EditorBlock`)**:
   - Guarded `registerRef` in `EditorBlock` with `if (registerRef && contentRef.current)`, preventing child refs from being overwritten by `null`.
2. **Universal Cross-Block Focus Dispatcher (`focusBlock`)**:
   - Implemented `focusBlock(targetBlock, position = "start" | "end")` supporting all 20 block types:
     - **Code**: Focuses `<textarea id="code_${id}">` with `setSelectionRange(0, 0)` for `start` or `(len, len)` for `end`.
     - **Table**: For `start`, focuses Header 0 or Row 0 Col 0. For `end`, dynamically resolves the bottom-right cell (`tbl_${id}_r_${lastRow}_c_${lastCol}`) and calls `setCaretToEnd`.
     - **Columns**: For `start`, focuses Column 1 title (`col_${id}_0_title`). For `end`, focuses the last column's content (`col_${id}_${lastCol}_content`).
     - **Math, Divider, Site, Media, Canvas**: Targets container elements by ID (`math_${id}`, `divider_${id}`, etc.) and applies `.focus()`.
     - **Toggle**: For `start`, focuses summary heading; for `end`, focuses details textarea if open.
     - **ContentEditable Blocks**: Sets caret to start or end via `setCaretToStart`/`setCaretToEnd`.
     - Includes automatic `requestAnimationFrame` and `setTimeout` retry fallback for newly mounted DOM elements.
3. **Deterministic Block IDs**:
   - Added explicit `id` attributes to `MathBlock` (`math_${block.id}`), `SiteBlock` (`site_${block.id}`), `MediaBlock` (`media_${block.id}`), `CanvasBlock` (`canvas_${block.id}`), and `Divider` (`divider_${block.id}`) for instant O(1) DOM resolution.
4. **Handler Integration**:
   - Wired `focusBlock` into `handleExitDown`, `handleExitUp`, `handleChangeType`, `handleAddAfter`, `handleSmartPaste`, `handleGlobalMouseUp`, and `handleKeyDown` (Backspace empty block deletion & ArrowRight block-end traversal).
5. **Verification**:
   - Added 7 unit tests in `tests/e2e_caret_navigation.test.js` (Tier 5). All 284 tests passing with 0 failures.

---

## 100. Group 2: Document Boundaries & Visual Line Metrics (BUG-TITLE-20, BUG-TITLE-21, BUG-TITLE-22, BUG-VIS-27, BUG-EXIT-16) & Temporal Dead Zone ReferenceError Fix

### Problem Statement
1. **TDZ Runtime ReferenceError (`Cannot access 'e0' before initialization`)**:
   - In production builds, `handleGlobalMouseUp` used `focusBlock` in its dependency array prior to the `const focusBlock = useCallback(...)` statement.
   - When Next.js bundled the minified script, evaluating the dependency array before the declaration threw `Uncaught ReferenceError: Cannot access 'e0' before initialization` on note workspace mount.
2. **Note Title ArrowDown Trapping (`BUG-TITLE-20`)**:
   - Inside the document Title `<input>`, pressing `ArrowDown` did not navigate into Block 0; focus stayed in the title.
3. **Block 0 Upward Traversal Gap (`BUG-TITLE-21`)**:
   - When on the first line of Block 0, pressing `ArrowUp` or `ArrowLeft` at start did nothing because `handleExitUp` guarded with `idx > 0`. Users could not return to the Title via keyboard.
4. **Note Title Enter Focus Failure on Complex Block 0 (`BUG-TITLE-22`)**:
   - Pressing `Enter` in the Note Title attempted `blockRefs.current[firstId]?.current?.focus()`.
   - If Block 0 was a `code`, `table`, `math`, `columns`, `site`, `media`, or `canvas` block, this reference was `null`, dropping focus entirely.
5. **Divider Keyboard Bypass (`BUG-EXIT-16`)**:
   - `handleExitDown`, `handleExitUp`, and `handleKeyDown` had `while (target.type === "divider") targetIdx++` loops that deliberately skipped divider blocks, making them completely unselectable and undeletable via arrow keys.
6. **Hardcoded 28px Visual Line Calculation Trapping Wrapped Headings (`BUG-VIS-27`)**:
   - `isCaretOnFirstVisualLine` and `isCaretOnLastVisualLine` used a hardcoded `<= 28px` bounding box comparison.
   - For `h1`–`h4` headings (which have font-size 30px, line-height 36px, and padding 12px), multi-line wrapped text exceeded 28px on intermediate lines, causing visual line detection to fail and trapping the caret.

### Resolution & Architectural Enhancements
1. **TDZ Reference Order Resolution**:
   - Hoisted `const registerRef` and `const focusBlock` to the top of `BlockNoteEditor` (immediately after reference initialization around line 5060), guaranteeing they are fully initialized before any callback or dependency array evaluates them.
2. **Note Title Bidirectional Arrow & Enter Handlers (`BUG-TITLE-20`, `BUG-TITLE-21`, `BUG-TITLE-22`)**:
   - Added `noteTitleInputRef` to the Title `<input>`.
   - Added `ArrowDown` handler to the Title input, routing directly into Block 0 via `focusBlock(blocks[0], "start")`.
   - Updated `Enter` in the Title input to invoke `focusBlock(blocks[0], "start")`, ensuring flawless focus transfer even if Block 0 is a table, code snippet, math formula, or multi-column layout.
   - In `handleExitUp`, when `idx === 0`, focus is transferred to `noteTitleInputRef.current?.focus()` with caret placed at the end of the title text (`noteTitleInputRef.current.setSelectionRange(len, len)`).
   - In `handleKeyDown` for `ArrowLeft`, when caret is at the start of Block 0, `handleExitUp` is triggered to step seamlessly into the Title.
3. **Native Keyboard Divider Navigation (`BUG-EXIT-16`)**:
   - Purged all `while (blocks[targetIdx].type === "divider")` bypass loops across `handleExitDown`, `handleExitUp`, and `handleKeyDown` (ArrowRight, Alt+ArrowUp, Alt+ArrowDown).
   - Dividers are directly selectable via arrow keys (`tabIndex={0}`, `id="divider_${block.id}"`), allowing instant `Backspace`/`Delete` removal or continued arrow navigation.
4. **Dynamic Relative Visual Line Calculations (`lib/editorCaret.js:BUG-VIS-27`)**:
   - Upgraded `isCaretOnFirstVisualLine` and `isCaretOnLastVisualLine` to measure caret Y-offsets against collapsed boundary ranges (`startRange.collapse(true)` and `endRange.collapse(false)`).
   - Added dynamic computed line-height scaling (`threshold = Math.max(28, padding + lineHeight * 0.6)`), accurately detecting first and last visual lines across all heading scales (`h1`–`h4`), custom typography styles, and browser zoom levels.
5. **Verification**:
   - Added 5 comprehensive tests in `tests/e2e_caret_navigation.test.js` (Tier 6). All 289 unit & integration tests passing with 0 failures.

---

## 101. Group 3: Nested Multi-Line Code & Math Editors (BUG-CODE-05, BUG-CODE-06, BUG-EXIT-15, BUG-MATH-03, BUG-MATH-04)

### Problem Statement
1. **CodeBlock Horizontal Arrow Boundary Trapping (`BUG-CODE-05`)**:
   - Inside the `<textarea>` of `CodeBlock`, pressing `ArrowLeft` at offset 0 or `ArrowRight` at the end of the text did nothing. Users could not navigate character-by-character into adjacent blocks without vertical arrow keys or mouse clicks.
2. **CodeBlock Premature Down Exit on Last Line (`BUG-CODE-06`)**:
   - `CodeBlock`'s down-arrow check evaluated `!val.substring(start).includes("\n")`.
   - When caret was at character 0 of the last line, `val.substring(start)` contained no newlines, so `isLastLine` was `true`. Pressing `ArrowDown` immediately exited the block instead of allowing native cursor movement across the last line or to the end of the line.
3. **Upward Exit into CodeBlock Landing at Offset 0 (`BUG-EXIT-15`)**:
   - Exiting upward from a block beneath `CodeBlock` focused the `<textarea>` without explicitly positioning the selection range, leaving the cursor at position 0 instead of the end of the code snippet.
4. **MathBlock Formula Textarea Arrow Trapping & Premature Exit (`BUG-MATH-03`)**:
   - In `MathBlock`'s LaTeX formula textarea, `ArrowDown` and `ArrowUp` unconditionally intercepted the keys and called `onExitDown` / `onExitUp`.
   - Users creating multi-line formulas (`Shift+Enter` for matrices, piecewise definitions, equation sets) could not navigate between lines with vertical arrow keys.
5. **MathBlock Container Backspace/Delete Inactivity (`BUG-MATH-04`)**:
   - When the `MathBlock` card container was selected or navigated to via arrow keys (when not in formula editing mode), pressing `Backspace` or `Delete` did nothing, preventing keyboard block removal.

### Resolution & Architectural Enhancements
1. **CodeBlock Horizontal Boundary Exits (`BUG-CODE-05`)**:
   - In `CodeBlock`'s `handleKeyDown`:
     - Intercept `ArrowLeft` when `selectionStart === 0 && selectionEnd === 0` and trigger `onExitUp(block.id)` to step into the preceding block.
     - Intercept `ArrowRight` when `selectionStart === val.length && selectionEnd === val.length` and trigger `onExitDown(block.id)` to step into the succeeding block.
2. **CodeBlock Non-Premature Last-Line Navigation (`BUG-CODE-06`)**:
   - In `CodeBlock`'s `ArrowDown` handler, changed the exit condition to `isLastLine && start === val.length`.
   - If the caret is on the last line but not yet at the end of the text, native textarea arrow movement allows stepping through the line. Only upon reaching the final character does the subsequent `ArrowDown` exit the block.
   - Mirror logic applied to `ArrowUp`: only exits when on the first line AND `start === 0`.
3. **Upward Entry Caret Placement at Snippet End (`BUG-EXIT-15`)**:
   - In `focusBlock` for `block.type === "code"` with `position === "end"`, explicitly calls `codeEl.focus()` followed by `codeEl.setSelectionRange(len, len)` (where `len = codeEl.value.length`).
4. **MathBlock Multi-Line LaTeX Traversal & Auto-Save (`BUG-MATH-03`)**:
   - Updated `MathBlock`'s `handleKeyDown` in the formula textarea:
     - `ArrowDown` checks `isLastLine && start === val.length` before exiting down; earlier lines now support full vertical arrow traversal.
     - `ArrowUp` checks `isFirstLine && start === 0` before exiting up.
     - Added `ArrowLeft` at offset 0 and `ArrowRight` at end of formula to allow seamless horizontal exits.
     - Automatically persists formula content via `handleSave()` before triggering block exit.
5. **MathBlock & CodeBlock Container Keyboard Deletion (`BUG-MATH-04`)**:
   - In `MathBlock`'s outer container `onKeyDown`, added handlers for `Backspace` and `Delete` when `!isEditing` to invoke `onDelete(block.id)`.
   - Also added `ArrowLeft` and `ArrowRight` support to the outer card container.
   - Added container `Backspace`/`Delete` removal and horizontal arrow keys to `CodeBlock`'s outer card container as well.
6. **Verification**:
   - Added 5 unit tests in `tests/e2e_caret_navigation.test.js` (Tier 7). All 294 unit and integration tests passing with 0 failures.

---

## 102. Group 4: 2D Grid & Multi-Column Layout Blocks (BUG-TBL-07, BUG-TBL-08, BUG-TBL-09, BUG-TBL-10, BUG-COL-11, BUG-COL-12, BUG-COL-13)

### Problem Statement
1. **TableCell Intermediate Row Traversal (`BUG-TBL-07`)**:
   - In `TableBlock`'s `handleCellKeyDown`, `ArrowDown` was only handled if `!isHeader && rowIndex === tableData.rows.length - 1`, and `ArrowUp` only if `isHeader`.
   - Pressing `ArrowDown` inside header cells or intermediate rows did nothing; pressing `ArrowUp` inside data rows did nothing. Users could not navigate vertically between table rows using arrow keys.
2. **TableCell Horizontal Arrow Cell Hopping (`BUG-TBL-08`)**:
   - `handleCellKeyDown` lacked handlers for `ArrowLeft` and `ArrowRight`.
   - When the caret reached the boundary of a table cell, pressing arrow keys did not hop into adjacent columns or wrap to the adjacent row.
3. **Headerless Table Upward Exit Trapping (`BUG-TBL-09`)**:
   - When a table had `hasHeaderRow: false`, `isHeader` was never true for any cell.
   - Because `ArrowUp` exit only triggered `if (e.key === "ArrowUp" && isHeader)`, pressing `ArrowUp` on Row 0 of a headerless table was completely ignored, trapping the cursor inside the table.
4. **Upward Exit into Table Resolving Top-Left Header (`BUG-TBL-10`)**:
   - Navigating up into a table from a lower block placed focus on `tbl_${block.id}_h_0` (the top-left cell) rather than the bottom-right cell (`tbl_${block.id}_r_${rowCount - 1}_c_${colCount - 1}`).
5. **Column Title Enter Inserting Newlines (`BUG-COL-11`)**:
   - In `ColumnItem`, `titleRef` is a `contentEditable` element.
   - Pressing `Enter` while focused on the title inserted a newline/line break instead of advancing focus to the column's note body.
6. **Column Content Trapped from Upward Title Navigation (`BUG-COL-12`)**:
   - In `ColumnItem`, `ArrowUp` was only intercepted when focused on `titleRef.current` (to exit up out of the block).
   - Pressing `ArrowUp` on the first line of `contentRef.current` did nothing, preventing users from returning to the column title via keyboard.
7. **ColumnsBlock Horizontal Arrow & Tab Column Hopping (`BUG-COL-13`)**:
   - `ColumnItem` lacked cross-column traversal. Pressing `Tab`, `Shift+Tab`, or boundary `ArrowLeft`/`ArrowRight` did not hop between columns.

### Resolution & Architectural Enhancements
1. **Full 2D Grid Arrow Traversal (`BUG-TBL-07` & `BUG-TBL-09`)**:
   - Updated `TableBlock`'s `handleCellKeyDown`:
     - `ArrowDown`:
       - From Header `colIndex`: moves down to `tbl_${block.id}_r_0_c_${colIndex}`.
       - From Data `rowIndex < rowCount - 1`: moves down to `tbl_${block.id}_r_${rowIndex + 1}_c_${colIndex}`.
       - From Data last row: invokes `onExitDown(block.id)` to exit downward into the succeeding block.
     - `ArrowUp`:
       - From Header: invokes `onExitUp(block.id)` to exit upward into the preceding block.
       - From Data `rowIndex > 0`: moves up to `tbl_${block.id}_r_${rowIndex - 1}_c_${colIndex}`.
       - From Data `rowIndex === 0`: if `hasHeaders`, moves up to `tbl_${block.id}_h_${colIndex}`; if `hasHeaderRow === false`, cleanly invokes `onExitUp(block.id)` (fixing `BUG-TBL-09`).
2. **Horizontal Table Cell Hopping (`BUG-TBL-08`)**:
   - In `handleCellKeyDown`:
     - `ArrowLeft` when `isCaretAtBlockStart`: moves to previous cell in the same row (`colIndex - 1`) and calls `setCaretToEnd`. If at `colIndex === 0`, wraps to the end of the previous row (or header) or exits up if at the very start of the table.
     - `ArrowRight` when `isCaretAtBlockEnd`: moves to next cell in the same row (`colIndex + 1`) and calls `setCaretToStart`. If at the last column, wraps to the first cell of the next row or exits down if at the very end of the table.
3. **Accurate Bottom-Right Entry Target (`BUG-TBL-10`)**:
   - In `focusBlock` when `position === "end"`, target cell is calculated as `tbl_${block.id}_r_${rowCount - 1}_c_${colCount - 1}` (or `tbl_${block.id}_h_${colCount - 1}` for header-only tables) with `setCaretToEnd(targetCell)`.
4. **Column Title Enter Advancing to Content (`BUG-COL-11`)**:
   - In `ColumnItem`'s `handleKeyDown`:
     - When `isTitle` and `e.key === "Enter" && !e.shiftKey`, calls `e.preventDefault()` and invokes `setCaretToStart(contentRef.current)`.
     - When `isTitle` and `ArrowDown` on the last visual line, advances caret to start of `contentRef.current`.
5. **Bidirectional Column Content Upward Navigation (`BUG-COL-12`)**:
   - In `ColumnItem`:
     - When `isContent` and `ArrowUp` on the first visual line (`isCaretOnFirstVisualLine(contentRef.current, range)`), calls `e.preventDefault()` and invokes `setCaretToEnd(titleRef.current)`.
6. **Cross-Column Tab & Horizontal Arrow Navigation (`BUG-COL-13`)**:
   - Passed `totalCols={localCols.length}` to each `ColumnItem`.
   - Implemented `Tab` (title -> content -> next column title -> next column content -> exit down) and `Shift+Tab` (reverse order).
   - Implemented boundary `ArrowLeft` and `ArrowRight` hopping across column titles and content bodies.
   - Added container card `Backspace`/`Delete` removal and arrow navigation to `TableBlock` and `ColumnsBlock` outer containers.
7. **Verification**:
   - Added 7 unit tests in `tests/e2e_caret_navigation.test.js` (Tier 8). All 301 unit and integration tests passing with 0 failures across 84 test suites.

---

## 103. Group 5: Dual-Zone Toggle & Block Merging/Deleting Flow (BUG-TOG-01, BUG-TOG-02, BUG-DEL-24, BUG-DEL-25)

### Problem Statement
1. **Toggle Header ArrowDown Skipping Details (`BUG-TOG-01` / `BUG-TOG-18`)**:
   - When a toggle block is expanded, pressing `ArrowDown` inside its summary header called `handleExitDown(blockId)`.
   - This skipped over the open details `<textarea>` entirely and moved the caret directly into the next block below the toggle.
2. **Toggle Details Textarea ArrowUp Skipping Summary Header (`BUG-TOG-02` / `BUG-TOG-19`)**:
   - In the toggle's details `<textarea>`, pressing `ArrowUp` on the first line called `onExitUp(block.id)`.
   - This bypassed the toggle's own summary header, jumping into the preceding block above the toggle.
3. **Ghost Focus on Backspace Empty Block Deletion (`BUG-DEL-24`)**:
   - Deleting an empty plain text block positioned between complex blocks (e.g. between a table and a code snippet) caused focus to drop into `document.body` or leave an unselected ghost state.
4. **Forward Delete at Line End Inactivity (`BUG-DEL-25` / `BUG-DEL-24` in report)**:
   - Pressing `Delete` at the end of a block only handled `standaloneEmbedTypes` (`divider`, `site`, `media`, `canvas`).
   - If the subsequent block was a normal mergeable paragraph or heading, pressing `Delete` did nothing instead of pulling and merging the next line.

### Resolution & Architectural Enhancements
1. **Dual-Zone Toggle Arrow Traversal (`BUG-TOG-01` & `BUG-TOG-02`)**:
   - In `handleKeyDown` for `ArrowDown`:
     - If the active block is an open toggle (`currentBlock.type === "toggle" && currentBlock.open !== false`), `ArrowDown` on the last visual line of the summary header focuses `toggle_details_${blockId}` via `setSelectionRange(0, 0)`.
   - In `EditorBlock` for the toggle `<textarea>`:
     - Assigned `id="toggle_details_${block.id}"`.
     - `ArrowUp` on line 1 at offset 0 intercepts the key, prevents default, and focuses the toggle summary header via `setCaretToEnd(contentRef.current)`.
     - Added boundary `ArrowLeft` (at offset 0 -> returns to summary header) and `ArrowRight` (at text end -> calls `onExitDown(block.id)`).
     - In `focusBlock` when entering an open toggle from below (`position === "end"`), accurately lands at the end of the details textarea (`setSelectionRange(len, len)`).
2. **Notion-Style Forward Delete Merging (`BUG-DEL-25`)**:
   - In `handleKeyDown` for `Delete` at the end of a block (`isCaretAtBlockEnd` / `textAfter.length === 0`):
     - If next block is a mergeable block (`text`, headings, lists, quote, callout): pulls and merges its content into the current block synchronously via `setBlockDOMFromText`, preserving the exact cursor offset via `setCaretAtOffset(el, domCaretOffset)`.
     - If next block is an empty text block: deletes it cleanly.
     - If next block is a standalone embed (`divider`, `site`, `media`, `canvas`): deletes it.
     - If next block is a complex card (`code`, `math`, `table`, `columns`): steps focus into its origin via `focusBlock(targetBlock, "start")`.
3. **Rock-Solid Empty Block Deletion with Double-Tick Focus Retention (`BUG-DEL-24`)**:
   - In `handleKeyDown` for `Backspace` on an empty block:
     - Checks both `block.content === ""` and `currentDOMText === ""`.
     - Calls `focusBlock(prevBlock, idx > 0 ? "end" : "start")` immediately and repeats in `requestAnimationFrame`, eliminating race conditions during React block re-renders and preventing ghost focus drops between complex blocks.
4. **Verification**:
   - Added 5 unit tests in `tests/e2e_caret_navigation.test.js` (Tier 9). All 306 unit and integration tests passing with 0 failures across 85 test suites.

---

## 104. Group 6: Inline Tools & Floating UI Focus Retention (BUG-FMT-18, BUG-SLASH-19, BUG-MATH-28, BUG-AUTO-25, BUG-FMT-02, BUG-FMT-29)

### Problem Statement
1. **Floating Selection Popover Focus/Caret Drop (`BUG-FMT-18`)**:
   - Applying `math` or `code` from `TextSelectionToolbar` called `setBlockDOMFromText`, which reset the target block's DOM but did not restore focus or place the caret, dropping active selection.
2. **Slash Command Dismissal Focus Drop (`BUG-SLASH-19`)**:
   - Closing `SlashMenu` via Escape or outside click closed the popup without returning keyboard focus to `contentRef.current`, requiring mouse interaction to resume typing.
3. **Inline Math Popover Blur/Save/Delete Focus Drop (`BUG-MATH-28`)**:
   - Saving, deleting, or closing `InlineEquationPopover` closed the modal without focusing `contentRef.current` or the parent table/column cell, leaving active element on `document.body`.
4. **Extraneous Space Before Punctuation in Auto-Formatting (`BUG-AUTO-25`)**:
   - `tryAutoFormatInlineCode` and `tryAutoFormatInlineMath` prepended `" "` to `afterText` unconditionally, resulting in awkward spacing when typing inline math/code directly before punctuation (`$formula$ .` or `` `code` , ``).
5. **Caret Trapped Inside Formatting Tags on Block Merge (`BUG-FMT-02`)**:
   - `setCaretAtOffset` placed the caret inside the text node of formatting tags (`<strong>`, `<em>`, `<u>`) when `offsetInNode === node.length`, causing subsequent typing to be inadvertently styled.
6. **Underline Stripped on Input / Serialization (`BUG-FMT-29`)**:
   - `getBlockTextFromDOM` lacked a handler for `<u>` and `<ins>` tags, causing underline formatting applied by the floating toolbar to be lost during serialization and roundtrip updates.
7. **Trailing `<br>` Desync in Empty Block Detection (`BUG-BR-01`)**:
   - Browser-injected solitary placeholder `<br>` tags in empty blocks were serialized as `\n` (length 1), causing `isCaretAtLogicalEnd` at offset 0 to report `false` (`0 >= 1`).

### Resolution & Architectural Enhancements
1. **Focus & Caret Retention in Floating Toolbar (`BUG-FMT-18`)**:
   - In `TextSelectionToolbar.handleFormat`: when formatting with `math` or `code`, synchronously places the caret at the end of the newly formatted element via `setCaretToEnd(activeEl)` and re-focuses `activeEl` in `requestAnimationFrame`.
2. **Deterministic Focus Return on Slash Menu Dismissal (`BUG-SLASH-19`)**:
   - In `EditorBlock.onClose` for `SlashMenu`: returns focus to `contentRef.current` via `requestAnimationFrame(() => contentRef.current?.focus())`.
3. **Inline Math Popover Focus Retention Across All Blocks (`BUG-MATH-28`)**:
   - In `EditorBlock`, `TableBlock`, and `ColumnsBlock`:
     - `handleMathSave` and `handleMathDelete` position the caret in the adjacent text node (or after the math pill) and restore focus to `contentRef.current` or `activeCellEl`.
     - `onClose` callbacks across all three hosts restore focus to the host element via `requestAnimationFrame`.
4. **Punctuation-Aware Auto-Formatting Spacing (`BUG-AUTO-25`)**:
   - In `lib/editorCaret.js` (`tryAutoFormatInlineCode` and `tryAutoFormatInlineMath`):
     - Inspects `afterText`: if `afterText` begins with punctuation (`[,\.!?;:\)\]\}\s]`) or already starts with a space, no leading space is inserted (`insertPrefix = ""`). Only word-character continuations or empty boundaries prepend a single space.
5. **Formatting Tag Boundary Escaping (`BUG-FMT-02`)**:
   - In `setCaretAtOffset`:
     - When `offsetInNode === node.length` at the end of an inline formatting tag (`strong`, `b`, `em`, `i`, `u`, `ins`, `del`, `s`, `code`, `mark`) without a next sibling within the tag, creates/locates a text node outside the tag and places the caret there.
6. **Lossless Underline Persistence (`BUG-FMT-29`)**:
   - Added `<u>` and `<ins>` tag parsing to `getBlockTextFromDOM` (`if (tag === "u" || tag === "ins") return inner ? "<u>" + inner + "</u>" : "";`).
   - Added underline token extraction and restoration to `formatMarkdownInline` (`<u>...</u>` / `<ins>...</ins>`).
7. **Trailing `<br>` Sanitization (`BUG-BR-01`)**:
   - In `getBlockTextFromDOM`, guarded against solitary placeholder `<br>` tags in empty blocks (`if (node.parentNode === domNode && domNode.childNodes.length === 1) return "";`).
   - In `isCaretAtLogicalEnd`, stripped trailing phantom newlines (`fullText.replace(/\n$/, "")`) to prevent offset desynchronization.
8. **Verification**:
   - Added 7 unit tests in `tests/e2e_caret_navigation.test.js` (Tier 10).
   - All 313 unit and integration tests passing with 0 failures across 86 test suites.

---

## 105. Extended Note Tab Caret Audit & Invariants (BUG-PASTE-01, BUG-TAB-01, BUG-UNDO-01, BUG-SEL-01, BUG-TITLE-23)

### Problem Statement
1. **Multi-Block Paste Caret Landing Position (`BUG-PASTE-01`)**:
   - In `handleSmartPaste`, inserting parsed markdown/HTML called `focusBlock(lastInserted, "start")`. The caret landed at character 0 of the final inserted block instead of at the true end of the pasted content.
2. **Tab Key Focus Loss to Browser Chrome (`BUG-TAB-01`)**:
   - Pressing `Tab` inside paragraphs, lists, quotes, or callouts was unhandled by keyboard listeners, causing native browser focus traversal out of the document into browser controls or space switcher.
3. **Undo/Redo Caret Focus Drop (`BUG-UNDO-01`)**:
   - `handleGlobalUndoRedo` replaced blocks state and triggered saves on `Ctrl+Z` and `Ctrl+Y`, but never called `focusBlock()`, leaving active focus on `document.body`.
4. **Multi-Block Marquee Deletion Focus Drop (`BUG-SEL-01`)**:
   - Deleting multiple selected blocks via Backspace/Delete cleared selection and set `selectedId = null` without placing caret focus on the adjacent remaining block.
5. **Title Right-Arrow Boundary Trap (`BUG-TITLE-23`)**:
   - Pressing `ArrowRight` at the end of Note Title input failed to navigate into Block 0.

### Resolution & Architectural Enhancements
1. **Pasting Caret Landing Position (`BUG-PASTE-01`)**:
   - In `handleSmartPaste`, updated focus calls to `focusBlock(lastInserted, "end")` both when replacing selected blocks and when appending to document.
2. **Soft Tab Indentation & Outdent (`BUG-TAB-01`)**:
   - In `EditorBlock.handleKeyDown`, intercepted `e.key === "Tab"` for non-code/non-table blocks:
     - `Tab`: Inserts 2 soft spaces at cursor range and updates DOM/state without losing focus.
     - `Shift+Tab`: Outdents leading 2 spaces if present.
3. **Deterministic Focus Restoration in Undo/Redo (`BUG-UNDO-01`)**:
   - In `handleGlobalUndoRedo`, added `focusBlock(targetId, "end")` via `requestAnimationFrame` on both undo and redo branches.
4. **Adjacent Block Focus Retention on Multi-Block Deletion (`BUG-SEL-01`)**:
   - In `handleMultiBlockKeydown`, computed adjacent surviving block index (`targetIdx = Math.max(0, Math.min(firstSelectedIdx, safeNext.length - 1))`) and focused it via `focusBlock(focusTarget, "end")`.
5. **Note Title ArrowRight Traversal (`BUG-TITLE-23`)**:
   - In Note Title input `onKeyDown`, added `ArrowRight` handler when `selectionStart === value.length` that calls `focusBlock(blocks[0], "start")`.
6. **Verification**:
   - Added Tier 11 test suite in `tests/e2e_caret_navigation.test.js` (5 new tests).
   - 318 total unit and integration tests passing across 87 test suites with 0 failures.

---

## 106. Prevention of Unwanted Block Creation on ArrowDown at Document Bottom (BUG-DOWN-01)

### Problem Statement
- When pressing `ArrowDown` inside an empty block (or any block at the end of the note), `handleExitDown` contained an `else` branch that called `handleAddAfter(blockId, "", "text")`.
- This caused an unwanted empty block to be appended to the bottom of the notes whenever the user pressed down, cluttering notes and causing focus jumping.

### Root Cause
- In `components/BlockNoteEditor.jsx`, `handleExitDown` assumed that reaching the end of the document (`idx === blocksRef.current.length - 1`) on `ArrowDown` should automatically spawn a new block below.
- In standard Notion-grade editors, `ArrowDown` at the document bottom should simply stay in place without spawning new blocks (new blocks are created explicitly via `Enter`, `+` in gutter, or clicking empty canvas whitespace).

### Resolution & Architectural Enhancements
1. **Remove Automatic Block Spawning in `handleExitDown`**:
   - In `handleExitDown`, removed the `else { handleAddAfter(...) }` branch. If `idx < blocksRef.current.length - 1`, it routes to the next block; otherwise, it stops cleanly.
2. **Guard `handleKeyDown` ArrowDown Listener**:
   - In `handleKeyDown`, added `const idx = blocks.findIndex((b) => b.id === blockId); if (idx < blocks.length - 1)` so that pressing `ArrowDown` on the final block leaves native boundary behavior without invoking `handleExitDown`.
3. **Automated Verification**:
   - Added `BUG-DOWN-01` unit test in `tests/e2e_caret_navigation.test.js`.
   - 319 unit and integration tests passing across 87 test suites with 0 failures.

---

## 107. Special Block Backspace Caret Retention & CodeBlock Boundary Traversal (BUG-DEL-26 & BUG-CODE-07)

### Problem Statement
1. **Unwanted Deletion of Preceding Special Blocks on Backspace (`BUG-DEL-26`)**:
   - When pressing `Backspace` on an empty line following special blocks (`divider`, `site`, `media`, `canvas`), an explicit `standaloneEmbedTypes` filter in `handleKeyDown` deleted the preceding special block instead of deleting the empty line and placing the caret in the special block.
2. **Code Snippet Boundary Traversal Clunkiness (`BUG-CODE-07`)**:
   - In `CodeBlock`, pressing `ArrowDown` on the last line required the caret to be at the exact end of text (`start === val.length`), while `ArrowUp` on line 1 required `start === 0`. If the caret was in the middle of a line, the arrow keys were trapped.
   - Clicking on the CodeBlock container or line numbers gutter did not forward focus to the inner `<textarea>`, leaving the outer card focused.

### Resolution & Architectural Enhancements
1. **Preserve Preceding Blocks & Delete Empty Line on Backspace (`BUG-DEL-26`)**:
   - In `components/BlockNoteEditor.jsx` (`handleKeyDown`), removed the `standaloneEmbedTypes` deletion of `blocks[idx - 1]`.
   - When `Backspace` is pressed on an empty line, the empty line itself is removed from document state, and `focusBlock(prevBlock, "end")` places the caret in the preceding block (whether code, table, math, columns, divider, site, media, or canvas).
   - When `Backspace` is pressed at offset 0 of a non-empty text block below a non-mergeable special block, focus transitions into `prevBlock` via `focusBlock(prevBlock, "end")` without deleting anything.
2. **Fluid CodeBlock Boundary Traversal & Event Bubbling Isolation (`BUG-CODE-07`)**:
   - In `CodeBlock` container `div`, added `if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;` to prevent arrow key events pressed inside `<textarea>` from bubbling to the outer wrapper and prematurely exiting the block.
   - In `CodeBlock.handleKeyDown`:
     - Added `e.stopPropagation()` across all 4 arrow keys (`ArrowDown`, `ArrowUp`, `ArrowLeft`, `ArrowRight`).
     - Allowed native multi-line cursor navigation between intermediate lines in code snippets.
     - When on the first line, `ArrowUp` exits up to the preceding block; when on the last line, `ArrowDown` exits down to the next block.
     - When at index 0, `ArrowLeft` exits up; when at string end, `ArrowRight` exits down.
   - In `MathBlock`, added the identical bubbling guard and `e.stopPropagation()` handlers.
   - Added container and gutter click-focus forwarding to `textareaRef.current`.
3. **Automated Verification**:
   - Added unit tests in `tests/e2e_caret_navigation.test.js` covering `BUG-DEL-26` across all 8 special block types and `BUG-CODE-07` bubbling isolation and multi-line navigation.
   - 321 unit and integration tests passing across 87 test suites with 0 failures (`npm test`).

---

## 108. Columns Split Block Deletion & Keyboard Lifecycle (BUG-COL-14)

### Problem Statement
- Pressing `Backspace` or `Delete` inside or upon selecting a column split block (`ColumnsBlock`) failed to delete the block.
- When selecting blocks via marquee/lasso selection, `handleMultiBlockKeydown` guarded deletion with `!isInput`. Because dragging the mouse across the canvas does not blur the previously focused `contentEditable` element, `isInput` remained `true`, causing `handleMultiBlockKeydown` to reject the `Backspace`/`Delete` command.
- Clicking the 6-dots `⠿` grip handle or the block card margins did not populate `selectedBlockIds` or blur lingering text inputs.
- `ColumnItem` lacked an `Escape` key handler to transition focus from text editing into block-level selection.

### Resolution & Architectural Enhancements
1. **Unconditional Multi-Block & Marquee Deletion (`BUG-COL-14`)**:
   - In `handleMultiBlockKeydown`, when `selectedBlockIds.size > 0`, `Backspace` and `Delete` delete the selected blocks unconditionally, regardless of lingering input focus states.
   - When marquee selection finishes (`handleGlobalMouseUp`), any lingering `document.activeElement` is explicitly blurred.
2. **Grip Handle & Card Margin Selection**:
   - In `EditorBlock` and `ColumnsBlock`, clicking the 6-dots `⠿` handle or clicking outside editable fields explicitly adds `block.id` to `selectedBlockIds` and blurs `document.activeElement`.
   - In `ColumnItem`, pressing `Escape` blurs the text field and selects the block into `selectedBlockIds`.
   - If the block is already selected in `selectedBlockIds`, pressing `Backspace` or `Delete` inside `ColumnItem` or `ColumnsBlock` immediately triggers deletion.
3. **Empty Block Deletion & Inter-Column Caret Hopping**:
   - When all columns in `ColumnsBlock` are empty, pressing `Backspace` or `Delete` deletes the split block and focuses the preceding surviving block.
   - Backspace and Delete smoothly hop between column titles and contents across all columns.
4. **Automated Verification**:
   - Added unit test `BUG-COL-14` in `tests/e2e_caret_navigation.test.js`.
   - 322 unit and integration tests passing across 87 test suites with 0 failures (`npm test`).

---

## 109. Input Isolation & Window Keydown Guard Against Preceding Block Deletion (BUG-DEL-27)

### Problem Statement
- When pressing `Backspace` on an empty text block located below a special block (`columns`, `divider`, `table`, `code`, `math`, `media`, `site`, `canvas`), the preceding special block was unexpectedly deleted.
- Root Cause: Accidental single-block population of `selectedBlockIds` on click, coupled with `window.addEventListener("keydown", handleMultiBlockKeydown)` intercepting `Backspace` on window before `handleKeyDown` ran. Even when the user was typing in an input, the window listener executed and deleted whatever block was stored in `selectedBlockIds`.

### Resolution & Architectural Enhancements
1. **Strict Input Early-Return in `handleMultiBlockKeydown` (`BUG-DEL-27`)**:
   - At the entry of `handleMultiBlockKeydown`, added `if (isInput) return;`.
   - When the user is focused inside ANY `contentEditable` element, `<input>`, or `<textarea>`, the window listener immediately yields and never intercepts `Backspace`, `Delete`, `Ctrl+C`, `Ctrl+X`, or `Enter`.
2. **Clear Multi-Selection on Focus Transition**:
   - `focusBlock` unconditionally executes `setSelectedBlockIds(new Set())`.
   - `handleKeyDown` at line entry executes `if (selectedBlockIdsRef.current?.size > 0) setSelectedBlockIds(new Set())`.
   - Removed single-block assignment to `selectedBlockIds` from `EditorBlock.onClick` and `ColumnsBlock.onClick`. `selectedBlockIds` is strictly reserved for genuine marquee drag selections.
3. **Container-Direct Deletion for Card Blocks**:
   - Special blocks (`ColumnsBlock`, `MathBlock`, `CodeBlock`) rely on their own container `onKeyDown` handlers with direct DOM focus, preventing global state pollution.
4. **Automated Verification**:
   - Verified that all 128 tests in `tests/e2e_caret_navigation.test.js` pass with 0 failures.
   - All 323 unit and integration tests passing across 87 test suites with 0 failures (`npm test`).

---

## 110. Table Mode Enter Key Handling at Last Row & Last Column (BUG-TBL-15)

### Problem Statement
- In table mode, pressing `Enter` on the last row of a table unexpectedly invoked `addRow()`, adding unwanted rows.
- The user expected that pressing `Enter` should never automatically add new rows or columns, and pressing `Enter` at the last row, last column should advance to the next block (or create a text block at the document bottom) and place the caret there.

### Resolution & Architectural Enhancements
1. **Prevent Automatic Row/Column Additions on Enter (`BUG-TBL-15`)**:
   - In `TableBlock.handleCellKeyDown`, removed `addRow()` from `Enter` key handling.
   - When on intermediate rows (`rowIndex < rowCount - 1`), pressing `Enter` navigates down to the cell below (`r_${rowIndex + 1}_c_${colIndex}`).
   - When on intermediate columns on the last row (`colIndex < colCount - 1`), pressing `Enter` steps to the next column in that row without adding rows or columns.
2. **Boundary Exit to Next Block**:
   - When pressing `Enter` on the last row and last column (`rowIndex === rowCount - 1 && colIndex === colCount - 1`), `handleCellKeyDown` calls `onExitDown?.(block.id)`.
   - Updated `handleExitDown` to return a boolean indicating whether a next block existed. If `false` (i.e. table is at document bottom), `TableBlock` calls `onAddAfter?.(block.id, "", "text")`, ensuring a clean paragraph is appended and focused.
3. **Automated Verification**:
   - Added unit test `BUG-TBL-15` in `tests/e2e_caret_navigation.test.js`.
   - All 128 tests in `tests/e2e_caret_navigation.test.js` pass with 0 failures.
   - All 323 unit and integration tests passing across 87 test suites with 0 failures (`npm test`).

---

## 111. Container Backspace Immunity & Reverse Focus Step (BUG-DEL-28)

### Problem Statement
- Pressing `Backspace` in a block below a table block, math block, or other special blocks caused the preceding special block to be inadvertently deleted.
- Root Cause:
  1. Outer containers of special blocks (`TableBlock`, `MathBlock`, `CodeBlock`, `ColumnsBlock`, `DividerBlock`, `SiteBlock`, `MediaBlock`, `CanvasBlock`) registered `if (e.key === "Backspace" || e.key === "Delete") onDelete(block.id)` on their root `<div tabIndex={0}>`.
  2. When the caret was placed at the end of the preceding block (or when React re-rendered upon deleting an empty sibling line), focus temporarily touched or fell upon the outer card container `<div tabIndex={0}>`.
  3. The active or repeating `Backspace` key event was immediately caught by the container's `onKeyDown` listener, triggering destructive block deletion!

### Resolution & Architectural Enhancements
1. **Container Immunity to Backspace (`BUG-DEL-28`)**:
   - Across ALL special block outer containers (`table`, `math`, `code`, `columns`, `divider`, `site`, `media`, `canvas`), removed `e.key === "Backspace"` from deletion triggers.
   - Containers now strictly respond ONLY to `e.key === "Delete"` (Forward Delete) when focused directly without active text inputs.
2. **Targeted Child Element Focus in `focusBlock`**:
   - `focusBlock(mathBlock, "end")` now targets the Equation Title input (`input`) and positions the caret at its end (`setSelectionRange(len, len)`), avoiding bare container selection.
   - `focusBlock(tableBlock, "end")` reliably targets the bottom-right cell and sets caret to end.
3. **Automated Verification**:
   - Updated and verified `BUG-MATH-04` in `tests/e2e_caret_navigation.test.js` to ensure containers ignore `Backspace` while accepting `Delete`.
   - All 128 tests in `tests/e2e_caret_navigation.test.js` pass with 0 failures.
   - All 323 unit and integration tests passing across 87 test suites with 0 failures (`npm test`).

---

## 112. Math Equation Title Keyboard Traversal & Bidirectional Focus (BUG-MATH-08)

### Problem Statement
- In LaTeX math equation blocks, pressing `ArrowUp` or `ArrowDown` while focused in the equation title `<input>` did nothing, trapping the caret in the title and preventing navigation past the math block.
- Root Cause:
  1. The Equation Title was rendered as an `<input type="text">` without an `onKeyDown` listener. Browsers ignore vertical arrows (`ArrowUp` / `ArrowDown`) inside standard single-line text inputs.
  2. The formula editing textarea (`textareaRef`) did not coordinate focus back up to the equation title on `ArrowUp` from the first line.

### Resolution & Architectural Enhancements
1. **Title Input Keyboard Handlers**:
   - Added an `onKeyDown` listener to the title `<input>` (`math_title_${block.id}`):
     - `ArrowUp`: calls `onExitUp?.(block.id)` to smoothly step to the block above.
     - `ArrowDown`: steps into the formula textarea if editing, or calls `onExitDown?.(block.id)` to step to the block below.
     - `ArrowLeft` at start (`selectionStart === 0`): calls `onExitUp?.(block.id)`.
     - `ArrowRight` at end: steps into formula textarea or calls `onExitDown?.(block.id)`.
     - `Enter`: toggles formula editing (`setIsEditing(true)`) and focuses the textarea.
2. **Formula Textarea Upward Traversal**:
   - In `MathBlock` textarea `onKeyDown`, pressing `ArrowUp` on line 1 now focuses `math_title_${block.id}` at the end, providing smooth bidirectional navigation between title, formula, and neighboring blocks.
3. **Automated Verification**:
   - Added unit test `BUG-MATH-08` in `tests/e2e_caret_navigation.test.js`.
   - All 130 tests in `tests/e2e_caret_navigation.test.js` pass with 0 failures.

---

## 113. Window Multi-Selection Isolation & Divider Reverse Step (BUG-DEL-29)

### Problem Statement
- Pressing `Backspace` in a block below special blocks (like `divider`, `site`, `media`, `canvas`) still caused the preceding block to be deleted.
- Root Cause:
  1. `handleMultiBlockKeydown` on window fell back to `effectiveIds = (selectedId ? new Set([selectedId]) : null)`.
  2. For non-text blocks (`divider`, `site`, etc.), `activeEl.isContentEditable` is false.
  3. When `focusBlock` placed focus on a divider after deleting an empty line, the active `Backspace` key event was caught by `handleMultiBlockKeydown`, which filtered out `effectiveIds` (`selectedId`), deleting the divider!

### Resolution & Architectural Enhancements
1. **Multi-Selection Isolation**:
   - In `handleMultiBlockKeydown`, strictly changed `effectiveIds` to activate ONLY when `selectedBlockIds && selectedBlockIds.size > 0`.
   - Single active blocks (`selectedId`) are never considered multi-block selections and are immune to window keydown deletion.
2. **Divider Reverse Step**:
   - Added `e.key === "Backspace"` handler to `DividerBlock`, `SiteBlock`, `MediaBlock`, and `CanvasBlock` so pressing Backspace steps to the block above (`onExitUp?.(block.id)`), rather than deleting.
3. **Automated Verification**:
   - Added unit test `BUG-DEL-29` in `tests/e2e_caret_navigation.test.js`.
   - All 130 tests in `tests/e2e_caret_navigation.test.js` pass with 0 failures.
   - All 325 unit and integration tests passing across 87 test suites with 0 failures (`npm test`).

---

## 114. Deprecation of Space Passwords, Factory Reset Modernization & Math Block Streamlining

### Problem Statement
1. **Space Password Complexity**: Space password locking added modal flows (`SetPasswordModal.jsx`, `EnterPasswordModal.jsx`), Base64 hashing traps, and UI friction in the spaces dropdown without serving active study goals.
2. **Factory Reset Math Puzzle**: Factory reset used a random arithmetic puzzle (`numA + numB = ?`) which felt quirky rather than providing an authoritative, intentional deletion barrier.
3. **Math Block Equation Title Clutter & Caret Traps**: Every `MathBlock` rendered an artificial title bar (`math_title_${block.id}`) defaulting to `"LaTeX Math Equation"`. This caused visual clutter, trapped arrow keys during vertical text navigation, and was completely ignored by all Markdown (`$$...$$`), HTML, DOCX, and AI serialization engines.

### Resolution & Architectural Enhancements
1. **Surgical Removal of Space Passwords**:
   - Deleted `components/SetPasswordModal.jsx`, `components/EnterPasswordModal.jsx`, and `tests/unit/password-security.test.mjs`.
   - Cleaned `Workspace.jsx`: removed state (`spacePasswords`, `setPasswordTarget`, `enterPasswordTarget`), `toBase64` helper, Dexie hydration of `socratic_space_passwords`, space deletion password cleanup, and password checks on `onSelectSpace`.
   - Cleaned `Sidebar.jsx`: removed `Lock`/`Unlock` icons, password props, and the space password lock button in the spaces dropdown.
2. **Modernized Factory Reset Confirmation**:
   - Replaced arithmetic captcha in `FactoryResetConfirmModal` with a standard typed `"RESET"` confirmation.
   - Confirmation button remains strictly disabled until `userAnswer.trim() === "RESET"`. Pressing Enter submits automatically when confirmed.
3. **Streamlined MathBlock in BlockNoteEditor**:
   - Removed the title input bar and `∑` badge from `MathBlock`, rendering the centered KaTeX formula directly inside the container.
   - Updated formula textarea `onKeyDown` so pressing `ArrowUp` on the first line immediately exits cleanly to the block above (`onExitUp`).
   - Container `Enter` key now toggles editing mode directly.
4. **Automated Verification**:
   - Updated unit test `BUG-MATH-08` in `tests/e2e_caret_navigation.test.js` for direct container and formula keyboard navigation.
   - All 322 automated tests pass with 0 failures across 86 test suites (`npm test`).

---

## 115. Surgical Removal of Canvas Whiteboard, PiP Timer Deletion, Alarm Redesign & 3-Font Typography Palette

### Problem Statement
1. **Canvas Whiteboard Redundancy**: `CanvasBlock` and `CanvasModal` added ~580 lines of HTML5 2D canvas drawing code (pencil, eraser, ruler guide, zoom, and undo stacks) that felt clunky and detracted from the clean text, KaTeX LaTeX, and Three.js 3D simulation architecture.
2. **Pinned Timers PiP Clutter**: `PinnedTimersOverlay.jsx` rendered floating draggable timer widgets in the bottom-right corner, redundantly duplicating the permanent top Global Timer HUD and obscuring notes and 3D viewports.
3. **Jarring Full-Screen Siren Alarm**: `AlarmOverlay.jsx` used an emergency `z-[9999]` flashing red pulsating border with square-wave buzzer audio and `🚨 ⏰ ❗️` icons that felt hostile and stressful rather than encouraging study breaks.
4. **Typography Clutter**: `NoteMenu.jsx` supported 5 fonts, where `handwriting` (Script) and `geometric` (Grotesk) caused line-height irregularities and visual conflicts with LaTeX formulas and table cells.

### Resolution & Architectural Enhancements
1. **Complete Removal of Canvas Whiteboard**:
   - Excised `CanvasBlock` and `CanvasModal` entirely from `BlockNoteEditor.jsx`, reducing editor bundle size by ~580 lines.
   - Removed `/canvas` from `SLASH_COMMAND_ITEMS`, `BLOCK_TYPES`, and standalone embed lists.
   - In `lib/exportImport.js` and `lib/blocks.js`, converted any legacy drawing blocks into standard callout cards so older documents load and export seamlessly without errors.
2. **Excised Pinned Timers Floating PiP Overlay**:
   - Deleted `components/PinnedTimersOverlay.jsx` and removed its import and `<PinnedTimersOverlay />` rendering from `Workspace.jsx`.
   - Removed the Pin/Unpin icon button in `GlobalTimerHUD.jsx`, keeping all timer management centered cleanly in the top navigation bar.
3. **Calm Study Break Modal Redesign (`AlarmOverlay.jsx`)**:
   - Replaced the flashing red pulsating border with an elegant, glassmorphic dark backdrop (`bg-ink-950/75 backdrop-blur-md`) and gold/amber rounded modal card (`border-duck-500/30`).
   - Replaced the harsh square wave audio with a gentle, harmonic C-major triad chime envelope (`[523.25, 659.25, 783.99] Hz` sine wave).
   - Replaced emergency icons with friendly study symbols (`✨ ⏰ ☕`) and updated browser alerts to `"⏰ Study Break / Timer Complete — SocraticOS"`.
   - Replaced blood-red buttons with warm duck-amber extend (`+1m`, `+2m`, `+5m`, `+10m`) and snooze controls.
4. **Curated 3-Font Typography Palette**:
   - Pruned `NOTE_FONTS` in `NoteMenu.jsx` to 3 clean, authoritative standards: **Default (Sans)**, **Serif (Academic / Humanities)**, and **Mono (Technical / STEM)**.
   - Legacy notes with `handwriting` or `geometric` automatically and safely fallback to `font-note-sans`.
5. **Automated Verification**:
   - Updated `tests/unit/table-block.test.mjs` and `tests/e2e_caret_navigation.test.js`.
   - All 322 automated tests pass with 0 failures across 86 test suites (`npm test`).

---

## 116. Trimming Onboarding Tour, Web Speech Dictation, Local Audio/Video Uploads & NoteMenu Redundancies

### Problem Statement
1. **Onboarding Tour Dead Weight**: The 8-step interactive onboarding tour (`InteractiveTutorial.jsx`, ~650 lines) was designed for first-time hackathon evaluators. For daily student use, it was dead code that added startup check overhead.
2. **Web Speech Dictation & Audio Synthesis Inconsistency**: `hooks/useVoice.js` and the voice control bar in `QuizPanel.jsx` relied on browser-dependent Web Speech API synthesis that lacked cross-browser consistency and added UI clutter above the Socratic chat dialogue.
3. **Database Bloat from Local Audio & Video Uploads**: `MediaBlock` allowed uploading raw audio (`.mp3`) and video (`.mp4`) files directly as base64 data URLs into IndexedDB notes, creating severe database bloat. Lightweight YouTube embeds and images provide superior study ergonomics.
4. **NoteMenu Redundancies**: `NoteMenu.jsx` included a manual "Save Note" button (redundant with auto-save, `Ctrl+S`, and top bar indicators) and "Open in New Tab" (which introduced potential multi-tab state desync in an IndexedDB single-page application).

### Resolution & Architectural Enhancements
1. **Excised Onboarding Tour**:
   - Deleted `components/InteractiveTutorial.jsx`.
   - Removed `tutorialOpen` state, URL search parameter auto-triggering, and bottom modal rendering from `Workspace.jsx`.
   - Removed "Restart Tutorial" action card from Settings in `Sidebar.jsx`.
2. **Excised Web Speech API Dictation**:
   - Deleted `hooks/useVoice.js`.
   - Stripped the voice control bar and message speech synthesizer button from `components/QuizPanel.jsx`.
3. **Streamlined MediaBlock to Images & YouTube**:
   - In `components/BlockNoteEditor.jsx`, restricted file uploads strictly to image formats (`accept="image/*"`).
   - Pruned media kinds to **Image** (`🖼️`) and **YouTube** (`▶️`), preserving YouTube 16:9 player embeds, timestamp URLs, and 25%/50%/100% width resize presets while eliminating raw audio/video database bloat.
4. **Cleaned NoteMenu Redundancies**:
   - Removed manual "Save Note" item and feedback from `components/NoteMenu.jsx`.
   - Removed "Open in New Tab" button and handler from sidebar `NoteMenu.jsx`.
   - Preserved user-requested QoL features: top bar note history (`Alt+←` / `Alt+→`), Lock Page toggle, Note Stats, Heading 4, and Instant Note (`Ctrl+I`).
5. **Automated Verification**:
   - All 322 automated tests pass with 0 failures across 86 test suites (`npm test`).

---

## 117. Streamlined Table Header (Removed Embedded Title Input) & Consolidated MathBlock Preset Tray

### Problem Statement
1. **Redundant Table Title Input**: `TableBlock` in `BlockNoteEditor.jsx` included an embedded `<input placeholder="Table title or caption (optional)...">` in its top toolbar. This diverged from standard Notion/Markdown document styling (where table context is expressed via preceding headings like `### Mitosis vs Meiosis`), caused visual clutter, and was never consumed by Markdown or HTML exports.
2. **Sprawling Preset Chips in MathBlock**: When editing a LaTeX formula in `MathBlock`, 7 separate preset chips were rendered across the bottom of the block, consuming vertical space and cluttering the card.

### Resolution & Architectural Enhancements
1. **Excised Table Title Input in `TableBlock`**:
   - Removed the `<input placeholder="Table title or caption (optional)...">` from `TableBlock` in `components/BlockNoteEditor.jsx`.
   - Redesigned the table header into a compact Notion-style bar: left side features `▦ Table` with the dynamic grid dimension badge (`Rows × Cols`), while the right side retains the `+ Column` and `+ Row` action buttons.
2. **Consolidated MathBlock Presets into Single Dropdown Button**:
   - In `MathBlock` in `components/BlockNoteEditor.jsx`, replaced the row of 7 sprawling chips with a single `✨ Presets ▾` toggle button in the bottom action bar alongside `Cancel` and `Done (Save)`.
   - Clicking `✨ Presets ▾` expands an organized tray containing both **Formula Templates** (Quadratic, Euler, Integral, Einstein, Normal Dist, Derivative, Matrix) and **Quick Symbols** (`\pi`, `\theta`, `\alpha`, `\sqrt{x}`, `\frac{a}{b}`, etc.) with 1-click insertion into the active cursor position.
3. **Preserved Essential Features**:
   - Retained both `callout` and `quote` blocks.
   - Retained the inline equation popover symbol and formula presets for accessible LaTeX drafting.
   - Retained document cover banners and gradient presets.
4. **Automated Verification**:
   - All 322 automated tests pass with 0 failures across 86 test suites (`npm test`).

---

## 114. Multi-Note Selection & Multi-Source Synthesis in Quiz Studio (`components/CreateQuizModal.jsx`, `components/QuizStudioView.jsx`, `lib/storageService.js`, `app/api/quiz/generate/route.js`, `lib/aiService.js`)

### Problem Statement
In the Quiz making interface (`CreateQuizModal.jsx`), users were limited to selecting a single source note via a standard HTML `<select>` element. Users could not synthesize quizzes across multiple notes (e.g. studying both *Cell Respiration* and *Photosynthesis*, or *Geometric Optics* and *Wave Optics* simultaneously). Furthermore, the AI quiz generator and grading rubrics only received content from a single note ID.

### Root Cause
- `CreateQuizModal.jsx` held state as a single scalar `selectedNoteId`.
- The Scope heading extractor only parsed headings from `selectedNote`.
- Note content serialization only pulled blocks from `selectedNote`.
- `lib/storageService.js`'s `saveQuiz` only captured `noteId` and `noteTitle` as singular string fields.
- `QuizStudioView.jsx`'s `handleSubmitQuiz` only fetched one note via `getNoteById(takingQuiz.noteId)`.
- The examiner system persona lacked instructions to synthesize cross-note relationships when multi-note inputs are provided.

### Resolution & Architectural Enhancements
1. **Interactive Multi-Select Source Note Combobox (`components/CreateQuizModal.jsx`)**:
   - Replaced the single `<select>` with a custom multi-select combobox featuring:
     - Real-time search query filtering.
     - One-click "Select All" and "Clear" buttons.
     - Per-note checkbox rows with note emojis and titles.
     - Selection counter badge (`X of Y selected`).
     - Removable chip badges with `✕` dismiss triggers.
     - Click-outside event listener for seamless popover dismissal.
2. **Cross-Note Headings Aggregation**:
   - Aggregated headings (H1–H4) from all selected notes.
   - Prefixed headings with parent note titles (`[Note Title] Heading Text`) to eliminate heading collisions (e.g., duplicate "Introduction" sections across notes).
3. **Structured Multi-Note AI Context Demarcation**:
   - Serialized each selected note's blocks via `editorBlocksToText` and framed them with clear section boundaries:
     ```text
     === Source Note: "<Title>" ===
     [Content]

     ----------------------------------------

     === Source Note: "<Title>" ===
     [Content]
     ```
   - Auto-generated composite titles (e.g., "Optics & Waves Quiz") and concepts.
4. **Examiner Persona Cross-Note Synthesis (`app/api/quiz/generate/route.js` & `lib/aiService.js`)**:
   - Updated examiner persona to recognize delimited source notes and synthesize questions probing cross-concept connections, comparisons, distinctions, and cross-topic mechanisms.
5. **Storage Schema & Backward Compatibility (`lib/storageService.js`)**:
   - Updated `saveQuiz` to store and preserve `noteIds` and `noteTitles` arrays, while falling back gracefully to single `noteId` and `noteTitle`.
6. **Multi-Note Quiz Cards & Complete Grading Context (`components/QuizStudioView.jsx`)**:
   - Added `📚 X notes` badge and clickable quick-jump links on quiz cards.
   - Updated taking quiz header to display all source notes.
   - In `handleSubmitQuiz`, dynamically resolves and concatenates text across all note IDs in `takingQuiz.noteIds` so the grading model has complete rubric context.
7. **Automated Unit Verification**:
   - Added 3 unit tests in `tests/unit/quiz-studio-flow.test.mjs` verifying multi-note quiz creation, storage, note text demarcation, and heading aggregation.
   - All 325 unit and integration tests passing (`npm test`).

---

## 115. Hierarchical Sub-Bullet Lists in Note Editor & AI Reformatter Support (`components/BlockNoteEditor.jsx`, `lib/blocks.js`, `lib/schemas.js`, `app/api/reformat/route.js`, `lib/aiService.js`, `lib/exportImport.js`)

### Problem Statement
In the SocraticOS Note Editor, bullet list blocks were strictly flat (`level: 0`). Users pressing `Tab` or `Shift+Tab` inside bullet points had literal two-space strings (`"  "`) inserted or sliced in the contentEditable DOM rather than creating true indented sub-bullets with visual hierarchy. Furthermore, the AI note reformatter (`/api/reformat` & client-side heuristic engine) had no concept of sub-bullet nesting in its schema, prompt persona, or block normalization.

### Root Cause
- `components/BlockNoteEditor.jsx`:
  - `handleKeyDown` intercepted `Tab` on non-code/non-table blocks and inserted soft spaces into the DOM rather than adjusting block hierarchy.
  - Bullet rendering rendered a single flat bullet glyph (`●`) with zero indentation margin.
  - `handleAddAfter` and `handleKeyDown` (Enter & Backspace) did not track or inherit bullet nesting levels.
- `lib/blocks.js`: `editorBlocksToText` flattened all bullets to `- ${content}` without indentation.
- `lib/schemas.js`: `REFORMAT_SCHEMA` had no `level` integer property for block items.
- `app/api/reformat/route.js` & `lib/aiService.js`: Examiner and reformatter personas lacked sub-bullet nesting guidance, and `normalizeReformattedNote` dropped `level`.
- `lib/exportImport.js`: `tryParseMarkdownToBlocks` stripped leading spaces before bullet items, flattening indented sub-bullets on markdown import.

### Resolution & Architectural Enhancements
1. **Interactive Sub-Bullet Keyboard State Machine (`components/BlockNoteEditor.jsx`)**:
   - **Tab**: Intercepted in `EditorBlock`. If `block.type === "bullet"` and `!e.shiftKey`, increments `level` (clamped to max 4) and triggers an atomic undoable block update via `onUpdateBlock(block.id, { level }, false, true)`. Works seamlessly on empty bullets or populated bullets.
   - **Shift+Tab**: If `level > 0`, decrements `level` by 1. If at `level: 0` on an empty bullet, converts the block to a plain text paragraph (`onChangeType(block.id, "text")`).
   - **Enter**: Pressing Enter on an empty sub-bullet (`level > 0`) unindents by 1 level before unformatting; pressing Enter on a populated sub-bullet inherits `level: block.level` onto the newly spawned bullet below.
   - **Backspace**: Pressing Backspace at offset 0 of a sub-bullet unindents by 1 level before converting to plain text.
2. **Visual Hierarchy & Distinct Glyphs**:
   - Level 0: Solid circular bullet `●` with standard margin.
   - Level 1: Hollow circular ring `○` with `1.5rem` left padding.
   - Level 2: Solid square `■` with `3.0rem` left padding.
   - Level 3+: Hollow square with `4.5rem+` left padding.
   - Dynamic placeholder: shows `"Sub-bullet item"` when `level > 0`.
3. **AI Reformatter & Gemini Schema Support (`lib/schemas.js`, `app/api/reformat/route.js`, `lib/aiService.js`)**:
   - Added `level: { type: "INTEGER", description: "..." }` to `REFORMAT_SCHEMA`'s block item definitions and `propertyOrdering`.
   - Updated `REFORMAT_PERSONA` in both server route and client AI service with instructions to structure sub-properties, examples, and nested bullet points with `level: 1` (or higher).
   - Updated `normalizeReformattedPayload` and `normalizeReformattedNote` to parse, validate, and clamp `level` between 0 and 4.
   - Updated `heuristicReformatBlocks` to preserve `level` on bullet blocks and accept either string or block array input.
4. **Lossless Markdown, Plain Text, HTML & DOCX Export/Import (`lib/exportImport.js`, `lib/blocks.js`)**:
   - `tryParseMarkdownToBlocks`: calculates indentation spaces (`indentSpaces / 2`) and assigns `level`.
   - `blocksToMarkdownLossy` & `editorBlocksToText`: serializes sub-bullets with `"  ".repeat(level)` indentation.
   - `blocksToPlainText`: prefixes bullet lines with `"  ".repeat(level) + "• "`.
   - `blocksToHTMLLossy`: applies `margin-left: ${level * 1.5}em` and circle/square list styles on sub-bullets.
   - `blocksToDocx`: scales paragraph left indent by `360 + level * 280`.
5. **Automated Verification**:
   - Added 4 unit tests in `tests/unit/reformat-note.test.mjs` verifying schema declaration, normalization with level clamping, heuristic parsing from indented markdown, and lossless markdown round-tripping.
   - All 329 automated unit and integration tests passing (`npm test`).

---

## 116. Quiz Deletion Confirmation Modal, Live Progress Auto-Saving & AI Reformatter Visual Feedback

### Problem Statement
1. **Accidental Quiz Deletion (`BUG-QUIZ-DEL-01`)**:
   - Clicking the trash can icon on a quiz card in the Quizzes tab or clicking "Delete Forever" / "Empty Trash" in the Trash tab either deleted immediately or used raw browser `confirm()`, causing accidental loss of generated quizzes, custom questions, and historical score analytics.
2. **Loss of In-Progress Quiz Answers & State (`BUG-QUIZ-SAVE-01`)**:
   - Quiz runner answers (`quizAnswers`) and current question index (`quizIndex`) were held in ephemeral component state without saving to IndexedDB until final exam submission. If the user navigated away, accidentally clicked back, switched tabs, or experienced a session interruption, all answered progress was erased.
3. **No Active Visual Feedback During AI Note Reformatting (`BUG-REFORMAT-VIS-01`)**:
   - Clicking "Reformat Note (AI)" from the Note Menu or top bar showed no visual indication on the trigger button. If the note lacked a banner or the user was scrolled down, the bottom/cover status toast was not visible, leaving the user unsure whether AI reformatting was active.

### Root Cause
- In `components/QuizStudioView.jsx`:
  - Delete buttons called `deleteQuizToTrash(quiz.id)` directly without a confirmation dialog.
  - `saveQuiz` in `lib/storageService.js` did not persist or preserve `draftAnswers` and `draftIndex`.
  - Quiz runner lacked auto-save handlers for option selection, text inputs, and question navigation.
  - Quiz grid cards had no state detection for in-progress drafts (`status === "in_progress"`).
- In `components/NoteMenu.jsx` & `components/BlockNoteEditor.jsx`:
  - `NoteMenu.jsx` had no `isReformatting` prop and rendered static text and icon.
  - `BlockNoteEditor.jsx` only rendered a toast nested inside the cover hover container, invisible without a banner or when scrolled down.

### Resolution & Architectural Enhancements
1. **Custom Delete Confirmation Modal (`DeleteQuizConfirmModal`)**:
   - Implemented an accessible glassmorphic modal with three distinct modes:
     - `trash`: Warns before moving an active quiz to the 24-hour trash bin.
     - `permanent`: Warns before permanently destroying a single quiz from trash.
     - `clear_all`: Warns before permanently emptying all items in the trash bin.
   - Features rich quiz metadata preview (title, difficulty badge, question count, score if completed), keyboard Escape dismiss, backdrop click dismiss, and red danger confirmation button.
2. **Live Quiz Progress Auto-Saving & Resume Architecture**:
   - Updated `lib/storageService.js` (`saveQuiz`) to persist and preserve `draftAnswers` (map of question index to option/text), `draftIndex` (last active question index), and `status: "in_progress" | "pending" | "completed"`.
   - In `components/QuizStudioView.jsx`:
     - Implemented `persistQuizProgress(updatedAnswers, targetIndex)` saving directly to Dexie `db.quizzes`.
     - Option selection (`multiple_choice`) auto-saves immediately.
     - Short/long answer textareas auto-save with a 350ms debounce.
     - Question navigation dots, Previous, and Next/Skip buttons update `draftIndex` and persist progress.
     - Runner header displays real-time auto-save feedback pill (`✓ Progress saved` / `Saving...`).
     - Back button (`<ArrowLeft>`) ensures latest answers are committed before exiting to the quiz library.
     - Quiz card grid detects drafts: displays `⏳ In Progress (X/Y)` badge and replaces button with `"Resume Quiz"` alongside a restart retake button.
     - Submitting the quiz clears `draftAnswers: null`, `draftIndex: 0`, and transitions status to `"completed"`.
3. **AI Reformatter Visual Feedback System**:
   - In `components/NoteMenu.jsx`: added `isReformatting` prop, rendering a spinning sparkle icon, `"Reformatting Note..."` label, pulsating "AI" badge, and `cursor-wait pointer-events-none` state while active.
   - In `components/BlockNoteEditor.jsx`: added a prominent top-center floating glassmorphic status banner (`fixed top-16 left-1/2 -translate-x-1/2 z-50`) with spinning sparkle, pulsating duck ring, and live progress indicators (e.g., chunk progress), transitioning cleanly to success or error toasts.
   - In `components/Workspace.jsx`: wired `onReformatStateChange` between `BlockNoteEditor` and `NoteMenu`.
4. **Automated Verification**:
   - Added 5 new unit tests in `tests/unit/quiz-studio-flow.test.mjs` verifying auto-saving of `draftAnswers` and `draftIndex`, quiz resume, submit cleanup, and trash clearing.
   - All 333 automated unit and integration tests passing (`npm test`).

---

## 117. AI Note Reformatter Visual Feedback Errors (Sparkles & React Error #31) & Quiz LaTeX Rendering

### Problem Statement
1. **Uncaught ReferenceError: Sparkles is not defined (`BUG-REFORMAT-SPARK-01`)**:
   - Triggering "Reformat Note (AI)" crashed with `Uncaught ReferenceError: Sparkles is not defined at BlockNoteEditor.jsx` when the newly added floating top-center progress banner attempted to render.
2. **Minified React Error #31: Objects are not valid as a React child (`BUG-REFORMAT-OBJ-01`)**:
   - During note reformatting, `onProgress` dispatched `{ current, total, message }` state objects. Rendering `{reformatProgress}` directly into JSX inside the banner caused React Error #31 (`object with keys {current, total, message}`).
3. **Raw LaTeX Delimiters & Missing Formula Typesetting in Quizzes (`BUG-QUIZ-LATEX-01`)**:
   - Quiz prompts, multiple choice options, short answer rubrics, and feedback for subjects like physics and chemistry contained unparsed LaTeX (e.g. `$\Delta G = \Delta H - T\Delta S$`, `\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`, or `\text{H}_2\text{SO}_4`), rendering raw markdown code instead of formatted mathematical equations and chemical formulas.

### Root Cause
- In `components/BlockNoteEditor.jsx`:
  - `Sparkles` and `AlertCircle` were referenced in the top-center visual banner JSX, but only `Lock` was imported from `"lucide-react"`.
  - `reformatProgress` held the raw progress object `{ current, total, message }` passed from `lib/aiService.js`, which was evaluated directly inside `<span>{reformatProgress}</span>` rather than reading its string message or part count.
- In `components/QuizStudioView.jsx` and `components/QuizPanel.jsx`:
  - Quiz questions, options, student answers, and grading rubrics were rendered as plain strings (`{currentQ.prompt}`, `{option}`, `{ans.prompt}`, `{ans.expectedAnswer}`), lacking LaTeX and KaTeX token parsing.

### Resolution & Architectural Enhancements
1. **Sparkles Import & Safe Progress Text Resolution (`components/BlockNoteEditor.jsx`)**:
   - Updated imports in `BlockNoteEditor.jsx` to explicitly include `{ Lock, Sparkles, AlertCircle } from "lucide-react"`.
   - Updated progress banner to safely resolve string labels (`typeof reformatProgress === "string" ? reformatProgress : reformatProgress.message || (reformatProgress.total > 1 ? \`Part \${reformatProgress.current} of \${reformatProgress.total}...\` : null)`), preventing object insertion into React children.
2. **Universal MathText Component & Segmentation Engine (`lib/mathUtils.js` & `components/MathText.jsx`)**:
   - Created `lib/mathUtils.js` (`parseMathSegments`):
     - Delimited Math: Tokenizes `$$...$$` / `\[...\]` (display math) and `$...$` / `\(...\)` (inline math) alongside plain prose.
     - Bare LaTeX Detection: Identifies unbracketed LaTeX expressions (e.g. `\frac`, `\sqrt`, `\text`, reaction arrows `\rightarrow`, subscripts `_{...}`, superscripts `^{...}`) commonly generated in quiz options.
   - Created `components/MathText.jsx`:
     - Renders segments using `renderKatexToStringMemoized` with LRU caching up to 500 items, `throwOnError: false` crash-proof fallback, and `katex/dist/katex.min.css` styling.
3. **Integration Across Quiz Studio & Quick Quiz Drawer**:
   - `components/QuizStudioView.jsx`: Wrapped question prompts, subtopics, multiple choice options, summary headlines, student answers, model rubrics, and feedback in `<MathText />`.
   - `components/QuizPanel.jsx`: Wrapped drawer quick quiz prompts, subtopics, options, question reviews, and rubric feedback in `<MathText />`.
4. **Automated Verification**:
   - Created `tests/unit/math-text.test.mjs` with 6 unit tests covering plain prose, inline `$math$`, display `$$math$$`, `\(math\)`, bare fraction and chemical equation options, and memoized KaTeX compilation.
   - Added unit test in `tests/unit/reformat-note.test.mjs` verifying safe string extraction from progress objects without React child errors.
   - All 340 automated unit and integration tests passing (`npm test`).

---

## 100. Redesigned Decluttered Quiz Runner Layout & Question Palette Station

### Root Causes & Problem Statements
1. **Cluttered Single-Column Quiz Taking Modal**:
   - In the Quizzes tab (`components/QuizStudioView.jsx`), when a user began taking a quiz, all controls (Previous Question, Next Question, Skip Question, question progress bars, Submit Exam, and Save status) were vertically stacked above and below the question card in a constrained `max-w-3xl` container.
   - On desktop displays, this wasted horizontal screen real estate while cramping the question prompt, multiple-choice options, and essay textareas.
2. **Missing Instant Jumper & Question Palette**:
   - The question progress indicators were small 2px horizontal bars requiring precise hovering to see question numbers, lacking clear visual states for answered versus unanswered questions and requiring cycling through questions sequentially to submit.
3. **No Convenient Way to Clear Answers**:
   - Learners had no direct option to unselect a chosen multiple choice answer or clear a drafted response without manual edits.

### Resolution & Architectural Enhancements
1. **Split-Screen Workspace Architecture**:
   - Redesigned `takingQuiz` in `components/QuizStudioView.jsx` to a 2-column layout (`flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-ink-950`).
2. **Dedicated Left/Center Q&A Canvas (`max-w-4xl`)**:
   - Provides an expansive, distraction-free reading and answering environment.
   - Top metadata row displays question number (`Question X of Y`), subtopic tag with LaTeX math rendering, and question type badge.
   - Generous prompt card (`p-6 md:p-8 rounded-2xl bg-ink-900 border border-ink-800 shadow-xl`) with large typography.
   - Multiple choice options feature full-width clickable cards with clear letter badges (`A`, `B`, `C`, `D`), glowing selected states, and hover keyboard indicators.
   - Short and Long Answer textareas feature generous vertical heights (`min-h-[180px]` and `min-h-[300px]`), live word counts, and evaluation guidance.
   - **Zero Bottom Clutter**: Removed all bottom navigation buttons from beneath the answer area so the user has maximum visual room.
3. **Dedicated Right-Hand Control & Navigation Station (`w-80 lg:w-88`)**:
   - **Streamlined Navigation**: Removed redundant "Navigation" text heading for a pure, button-first interface.
   - **Primary Action**: Prominent Next/Skip button (`ArrowRight`) that automatically morphs into "Finish & Submit Exam" (`CheckCircle2`) on the final question.
   - **Secondary Actions**: "Previous" button (`ArrowLeft`) and a dedicated "Clear" button (`Eraser`) that resets the active question's answer immediately.
   - **Interactive "Questions" Navigator Matrix**: Renamed from "Question Palette" to "Questions" with 5-column numbered matrix:
     - Current question: Duck-400 ring, high-contrast badge, scale accent.
     - Answered questions: Vivid `emerald-500/20` background with glowing `emerald-400` status dot (resolving invisible color issue caused by missing Tailwind theme token).
     - Unanswered questions: Subtle border styling.
     - Single-click jumping to any question without sequential clicking.
   - **Exam Progress & Submission Actions**: Continuous progress percentage bar, auto-save status indicator, standalone "Submit Exam" button accessible anytime, and "Save Progress & Exit" button.
4. **Header Clutter Elimination**:
   - Removed long "Source: X notes (...)" text from the runner header to preserve clean, unencumbered title presentation.
5. **High-Contrast Review Diagnostic Cards**:
   - Addressed low-contrast 5% opacity review cards that made differentiating right and wrong answers difficult.
   - Correct answers render with distinct `bg-emerald-950/25 border-emerald-500/40` card backgrounds, `✓` icon boxes, `✓ Correct` badges, and green answer chips.
   - Incorrect answers render with distinct `bg-rose-950/25 border-rose-500/40` card backgrounds, `✗` icon boxes, `✗ Incorrect` badges, red answer chips, and glowing emerald correct answer callouts.
6. **Keyboard Hotkey Engine**:
   - Added global keyboard listeners: `ArrowRight` (Next/Skip), `ArrowLeft` (Previous), and `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4` to select options. Safely bypassed whenever typing in a textarea or input.
7. **Automated Verification**:
   - Added unit tests in `tests/unit/quiz-studio-flow.test.mjs` verifying answer clearing logic, answered count recalculation, and hotkey option index mapping.
   - All 342 unit and integration tests passing (`npm test`).

---

### 101. Decluttered Multi-Note Quiz Cards & Dedicated Source Notes Modal

#### Problem Statement
In the Quizzes Studio dashboard, quizzes created from multiple notes (e.g. 19 chapters) rendered a bloated cloud of individual note buttons on the card face. This caused jagged line wraps, truncated ellipsis text ("Chapter 1:...", "Chapter 3: Movemen..."), wildly inconsistent card heights across grid rows, and extreme visual clutter. Furthermore, auto-generated quiz titles concatenated multiple full-length chapter names into excessively long 100+ character titles.

#### Root Cause
1. In `components/QuizStudioView.jsx`, multi-note quizzes mapped all elements of `quiz.noteIds` directly inside the card body into a flex-wrapping container with fixed `max-w-[130px]` truncation.
2. In `components/CreateQuizModal.jsx`, `toggleNote` concatenated full note titles with `&`, creating excessively long default names when multiple chapters were checked.

#### Resolution
1. **Compact Single-Line Card Pill**:
   - Replaced the sprawling multi-button cluster with a neat, standardized pill button: `[📚 X notes • View notes →]`.
   - Constrained single-note items to 1 clean line with truncation.
   - Standardized card dimensions and vertical rhythm across the entire quiz grid.
2. **Dedicated Source Notes Modal (`SourceNotesModal`)**:
   - Built an accessible modal triggered by the card pill displaying all source notes with full untruncated titles.
   - Integrated live instant search filtering when notes exceed 4.
   - Provided direct "Open →" buttons jumping straight into the note editor (`onSelectNote` + `setActiveTab("notes")`).
3. **Clean Auto-Title Synthesis**:
   - Updated `CreateQuizModal.jsx` to generate clean titles (e.g., `Biology Synthesis Quiz (19 Notes)`) when more than 3 notes are selected, and neatly trimmed titles when 2–3 notes are picked.
4. **Automated Verification**:
   - Added unit tests in `tests/unit/quiz-studio-flow.test.mjs` verifying source notes normalization, query filtering, and concise title synthesis.
---

### 102. Quiz Making Interface & Codebase-Wide Performance Optimization

#### Problem Statement
Users reported noticeable UI lag and stutter in the Quiz Making Interface (`CreateQuizModal.jsx`), specifically when dragging question count sliders (MCQ, Short Answer, Long Essay), typing in text inputs (Quiz Title, Note Filter Search, Custom Focus), or selecting section headings across multiple notes. In addition, an audit of the codebase revealed several hot-path performance bottlenecks causing frame drops during document scrolling, note typing, and exam taking.

#### Root Causes
1. **Slider Gradient Transition Thrashing (`app/globals.css`)**:
   `input[type="range"].quiz-slider` had `transition: all 0.15s ease`. When dragging sliders, inline `style={{ background: linear-gradient(...) }}` updated continuously on pointer movement. The browser attempted to animate the CSS `background` gradient over 150ms on every mouse move, which cannot be hardware accelerated, causing severe frame drops and sticky slider thumb tracking.
2. **Unmemoized Slider Components (`components/CreateQuizModal.jsx`)**:
   `QuestionCountSlider` was an unmemoized component. Dragging one slider (e.g. MCQ) forced all 3 sliders to re-render and recompute gradient percentages at 60+ updates per second.
3. **Linear Heading Lookups & Universal Transitions (`components/CreateQuizModal.jsx`)**:
   When selecting section headings across multiple notes, `headings.map(...)` performed `selectedHeadings.includes(h.displayLabel)` inside the loop ($O(N \times M)$ comparisons per render). Furthermore, each heading card had `transition-all`, forcing style/layout recalculations across dozens of heading DOM elements.
4. **Wasted Background Work When Closed (`components/QuizStudioView.jsx` & `CreateQuizModal.jsx`)**:
   `CreateQuizModal` was unconditionally mounted in `QuizStudioView.jsx`. Even when closed (`isCreateOpen === false`), React evaluated all hook dependencies (`currentNotes`, `filteredNotes`, `selectedNotes`, and `extractHeadingsFromBlocks`) on every background update.
5. **Outline Scroll Spy Layout Thrashing (`components/BlockNoteEditor.jsx`)**:
   The table of contents outline scroll spy attached an un-throttled scroll listener that synchronously invoked `getBoundingClientRect()` on every heading block for every scroll event pixel, forcing synchronous layout recalculations (layout thrashing) and triggering un-guarded state updates.
6. **Command Palette Background Indexing (`components/CommandPalette.jsx`)**:
   `CommandPalette`'s `items = useMemo(...)` mapped and aggregated all notes and bookmarks across the entire workspace on every note auto-save keystroke, even while closed.
7. **Exam Runner Live Query Trashing (`components/QuizStudioView.jsx`)**:
   Option picks wrote to IndexedDB immediately, firing Dexie's `useLiveQuery` to reload all quizzes from disk and recompute `filteredQuizzes` and `counts` while the user was answering questions.

#### Resolution
1. **Zero-Lag Slider CSS**:
   Updated `input[type="range"].quiz-slider` in `app/globals.css` from `transition: all 0.15s ease` to `transition: opacity 0.15s ease`, allowing inline background gradients to update instantly without browser transition delay.
2. **Memoized Sliders & Heading Items**:
   Wrapped `QuestionCountSlider` in `React.memo`. Created a memoized `HeadingCheckboxItem` with `transition-colors`, eliminating cascading re-renders across sibling controls.
3. **$O(1)$ Heading Set Indexing**:
   Created `selectedHeadingsSet = useMemo(() => new Set(selectedHeadings), [selectedHeadings])`, reducing selection checks inside `.map` from $O(N)$ to $O(1)$.
4. **Conditional Mounting & Closed Guards**:
   Rendered `{isCreateOpen && <CreateQuizModal ... />}` in `QuizStudioView.jsx` and added `if (!open) return []` guards in all `useMemo` hooks inside `CreateQuizModal.jsx`.
5. **RAF Throttled Scroll Spy**:
   Wrapped `handleScroll` in `BlockNoteEditor.jsx` with `requestAnimationFrame` tick scheduling (`ticking` flag) and guarded `setActiveHeadingId` with equality checks, guaranteeing at most 1 measurement per frame and zero redundant state dispatches.
6. **Lazy Command Palette Evaluation**:
   Added `if (!isOpen) return []` guards to `items` and `filteredItems` in `CommandPalette.jsx`, eliminating background note aggregation during document editing.
7. **Debounced Quiz Progress & Runner Isolation**:
   Debounced `persistQuizProgress` by 250ms on option picks in `QuizStudioView.jsx` while keeping local UI updates instantaneous, flushing on question transitions or runner exit, and short-circuited `filteredQuizzes` and `counts` computations while taking an exam.
8. **Automated Verification**:
   Added unit tests in `tests/unit/quiz-studio-flow.test.mjs` verifying $O(1)$ heading set lookups and closed modal extraction guards. All 346 unit and integration tests passing (`npm test`).

---

## 63. AI Tutor Rich Markdown, Code Syntax Highlighting & KaTeX Integration

### Problem Statement
The newly introduced AI Tutor chat interface rendered model responses exclusively via plain `MathText`. While LaTeX expressions were properly rendered, standard markdown formatting returned by the LLM (such as Markdown headings `###`, numbered steps `1.`, bullet points `-`, blockquotes `>`, fenced code blocks ` ``` `, and Markdown tables `| Col |`) were displayed as raw unparsed text or flat strings, making complex multi-step physics/math explanations and code snippets difficult to read.

### Resolution & Architectural Enhancements
1. **Built Universal `MarkdownRenderer` Component (`components/MarkdownRenderer.jsx`)**:
   - Structured block decomposition parser supporting:
     - **Headings (`#`, `##`, `###`, `####`)**: Formatted with distinct font scales, colors, and divider borders.
     - **Fenced Code Blocks (` ```lang ... ``` `)**: Tokenized via `lib/syntaxHighlighter.js` with full 10-language syntax highlighting (JavaScript, Python, C++, Java, Rust, SQL, HTML, CSS, TypeScript, JSON) and an integrated 1-click **Copy** button.
     - **Display Math (`$$...$$`) & Inline Math (`$...$`)**: Delegated directly to KaTeX via `renderKatexToStringMemoized` with fallback escaping.
     - **Markdown Tables (`| Col 1 | Col 2 |`)**: Formatted with header borders, zebra striping, and cell-level markdown rendering.
     - **Lists (Numbered `1.` & Bullet `-`)**: Formatted as structured `<ol>` and `<ul>` lists with generous line-height and bullet alignment.
     - **Blockquotes (`> ...`)**: Styled with `border-l-2 border-duck-400/80 bg-ink-950/60 pl-3 py-1 text-xs italic text-ink-300`.
     - **Inline Markdown Formatting**: Full support for bold (`**bold**`), italic (`*italic*` or `_italic_`), inline code (`` `code` ``), strikethrough (`~~del~~`), and links (`[label](url)`).
2. **Integrated `MarkdownRenderer` into `AITutorPanel.jsx`**:
   - Replaced basic `MathText` invocation in tutor message bubbles with `<MarkdownRenderer content={msg.content} />`.
3. **Automated Unit Testing (`tests/unit/ai-tutor.test.mjs`)**:
   - Added unit tests validating decomposition of sample tutor responses containing headings, display math, python code blocks, numbered steps, blockquotes, and tables. All 352 unit tests pass (`npm test`).

---

## 64. Photorealistic 3D Human Respiratory Mechanics & Model Alignment Overhaul

### Problem Statement
1. **Model Coordinate Space & Orientation Mismatch**:
   - The raw 3D photorealistic medical lung scan (`public/models/lung.glb`, 17.1 MB, 33,000+ vertices) exported from Maya/FBX was oriented with high positive coordinates along the $Z$ plane rather than the upright $Y$ thoracic axis.
   - When initially loaded in `PhotorealisticMedicalLungs` with default zero rotation and uncompensated bounding coordinates, the model was flattened horizontally and shrunk, rendering it virtually invisible inside the ribcage.
2. **HUD Panel Occlusion & Unclosable Overlay**:
   - The floating physiological control HUD in `RespiratoryCanvas.jsx` had a fixed width of 360px without a minimize/collapse toggle, occluding the left hemisphere of the thoracic cage and diaphragm.
3. **Unclosed JSX Conditional Syntax in Production Build**:
   - A misplaced closing tag inside `{onOpenQuiz && (...)}` triggered an `Unterminated regexp literal` syntax error during `next build`.

### Resolution & Architectural Enhancements
1. **Coordinate Transformation & Dynamic Anatomical Alignment (`RespiratoryCanvas.jsx`)**:
   - Calculated the exact accessor position bounds and parent node transformation matrices: applied `rotation={[Math.PI / 2, 0, 0]}`, scaled by `baseScale = 1.62` with dynamic breathing volume expansion $(s_X, s_Y, s_Z)$, and centered at `position={[0, -0.05 + expansion * 0.08, 0.48]}`.
   - Enabled shadow casting and receiving across all cloned mesh primitives.
2. **Collapsible HUD with Progressive Disclosure (`RespiratoryCanvas.jsx`)**:
   - Added `isCollapsed` state with a header toggle button (`Maximize2` / `Minimize2`) allowing users to collapse the HUD to an unobtrusive pill for an unobstructed, 100% full-screen view of the anatomical model.
3. **Syntax Rectification & Production Build**:
   - Fixed the JSX conditional closure in `RespiratoryCanvas.jsx`.
   - Verified via SWC parser and passed the full automated test suite (360 tests).
   - Built clean production artifacts (`npm run build`) and restarted the server daemon on port 3000 (`npm run start`).

---

## 65. Genuine CT Thoracic Skeleton Integration, Antagonistic Intercostals & Diaphragm Hiatuses Overhaul

### Problem Statement
1. **Procedural Bone Approximations**:
   - The ribcage, sternum, and spine were previously composed of simplified procedural tubes and cylinders that lacked authentic human bone morphology, costal angles, costovertebral articulations, vertebral spinous/transverse processes, and sternal manubrium/gladiolus geometry needed for medical/biology education.
2. **Missing Intercostal Layer Discrimination**:
   - The antagonistic intercostal muscles were rendered as monolithic procedural bundles without independent isolation of the superficial **External Intercostals** (inspiratory agonists, $+35^\circ$ down-and-forward fiber orientation) versus the deep **Internal Intercostals** (forced expiratory agonists, $-45^\circ$ down-and-backward fiber orientation).
3. **Diaphragm Dome Anatomical Details & Orifices**:
   - The muscular diaphragm dome lacked key anatomical apertures (*hiatuses*)—specifically the **Vena Caval Foramen (T8)**, **Esophageal Hiatus (T10)**, and **Aortic Hiatus (T12)**—as well as the pearly trifoliate central tendon aponeurosis (*centrum tendineum*) and bilateral lumbar crura anchoring into L1–L3.

### Resolution & Architectural Enhancements
1. **Clinical CT-Derived Human Thoracic Skeleton (`skeleton_ct.glb`, 16.3 MB)**:
   - Extracted and isolated 43 genuine clinical CT thoracic bone nodes from `skeleton_ct.glb`: all 12 left ribs (`l_rib1`–`l_rib12`), all 12 right ribs (`r_rib1`–`r_rib12`), all 12 thoracic vertebrae (`t1`–`t12`), lumbar vertebrae (`l1`–`l3`), sternum, xiphoid process, and bilateral clavicles.
   - Set non-thoracic skeleton nodes (cranium, mandible, cervical spine, pelvis, arms, legs) to `visible = false`.
   - Scaled to `11.2` and centered at `[-0.01, -2.66 + expansion * 0.08, 0.26]` to naturally envelop `lung.glb` with authentic anatomical metric clearance.
   - Assigned PBR calcium bone material (`ANATOMICAL_PALETTE.boneIvory`, roughness `0.38`, metalness `0.06`) with dynamic cutaway opacity support.
   - Programmed per-frame breathing kinematics in `useFrame`:
     - **Bucket-handle lateral swing**: Ribs 3–10 roll outward laterally around the AP axis (`rotation.z`).
     - **Pump-handle anterior elevation**: Ribs 1–5 elevate anteriorly (`rotation.x`), while the sternum and xiphoid lift upward and forward (`position.y`, `position.z`, `rotation.x`).
2. **Multi-Layer Antagonistic Intercostal Muscle System (`PhotorealisticIntercostalMuscles`)**:
   - Spans the 11 intercostal spaces with discrete striated myofibril fascicles.
   - **External Intercostal Layer**: Positioned on the superficial margin with $+35^\circ$ oblique down-and-forward orientation; spikes with active ruby tension glow (`#ef4444`, emissive intensity 1.45) and swells in diameter during inspiration.
   - **Internal Intercostal Layer**: Positioned on the deep margin with $-45^\circ$ oblique down-and-backward orientation; spikes with active crimson tension glow (emissive intensity 1.55) and swells in diameter during forced expiration.
   - Added `muscleMode` selector (`"both" | "external" | "internal"`) in the HUD to allow students to isolate individual muscle layers.
3. **Sculpted Diaphragm Dome with Central Tendon, Hiatuses & Crura (`SculptedDiaphragmDome`)**:
   - Modelled the trifoliate pearly central tendon (*centrum tendineum*) with anterior, right, and left leaflets textured with glistening collagen aponeurosis.
   - Incorporated the 3 major anatomical openings:
     - **Vena Caval Foramen** at T8 level (right leaflet of central tendon).
     - **Esophageal Hiatus** at T10 level (muscular right crus fibers).
     - **Aortic Hiatus** at T12 level (posterior midline).
   - Anchored bilateral muscular crura into the anterior bodies of L1–L3 lumbar vertebrae.
   - Real-time dynamic vertex deformation: flattens vertically during inspiration (`domeHeight = -0.34 - expansion * 0.82`) and elastically recoils into a high convex double-dome during expiration.
4. **Enhanced HUD Controls & Layer Management**:
   - Added toggle switches for 3D Medical Lungs Scan, 3D CT Thoracic Skeleton, Thoracic Bones Framework, Muscular Diaphragm Dome, and Striated Intercostal Muscles with layer selector buttons.
5. **Automated Verification & Production Deployment**:
   - All 360 unit tests pass cleanly (`npm test` and `respiratory-mechanics.test.mjs`).
   - Rebuilt production bundle (`npm run build`) and restarted daemon on port 3000 (`npm run start`), verified `200 OK`.

---

## 66. Complete Legacy Procedural Component Removal & Realistic Diaphragm and Intercostal Integration

### Problem Statement
1. **Procedural Occlusion & Scene Clutter**:
   - Legacy procedural placeholders (`SemiTransparentTorso` cyan cylinder, `AnatomicalAirwayTree` cylinders, `SculptedProceduralLungs` spheres) were still mounting in the 3D scene. Specifically, `SemiTransparentTorso` wrapped the entire thorax in a semi-opaque cyan cylinder, occluding the intercostal muscles and diaphragm from view.
   - The imported `lung.glb` already contained an authentic medical trachea, carina, and bronchial tree, rendering `AnatomicalAirwayTree` redundant and causing visual z-fighting.
2. **Missing Component References in Suspense Fallback**:
   - During skeletal loading, `RealisticCTSkeleton` fell back to `RealisticSpine`, `RealisticSternum`, and `ProceduralRibcage`, whose declarations had been removed, creating a potential runtime crash trap if a network or hydration delay occurred.
3. **Diaphragm & Muscle Visibility in Production**:
   - The production Next.js daemon was serving an earlier static build prior to the completion of the CT-aligned intercostal and diaphragm shaders.
   - The resting muscle palette used a dull slate gray (`#4b5563`) that was difficult to discern against the dark scene background.

### Resolution & Architectural Enhancements
1. **Total Removal of Legacy Procedural Components**:
   - Completely deleted `SemiTransparentTorso`, `AnatomicalAirwayTree`, and `SculptedProceduralLungs` from `RespiratoryCanvas.jsx`.
   - Replaced all Suspense fallbacks with clean `fallback={null}`, preventing any procedural cylinders or spheres from rendering during model initialization.
   - Cleaned up unused texture generation routines (`generatePleuralLungTexture`).
2. **Prominent, Dual-Layer Striated Intercostal Muscles (`PhotorealisticIntercostalMuscles`)**:
   - Mapped across all 11 genuine CT intercostal spaces with 6 discrete fascicle pairs per side for each layer (132 active muscle fascicles total).
   - Upgraded fascicle thickness (`extRadius = 0.058 * (1 + extTension * 0.36)`, `intRadius = 0.052 * (1 + intTension * 0.36)`).
   - **External Layer**: Superficial margin, $+35^\circ$ infero-anterior oblique angle ("hands in pockets"), active during inspiration with lateral transverse swelling and bright scarlet emissive glow (`#ef4444`, intensity 1.7).
   - **Internal Layer**: Deep margin (recessed inward by 0.06 units), $-45^\circ$ infero-posterior oblique angle, active during forced expiration with active depression emissive glow (intensity 1.8).
   - Updated baseline muscle color to a rich oxygenated crimson (`#881337` / `#9f1239`) so muscles are clearly visible even when relaxed.
   - HUD layer toggle allows instant isolation: "Both Layers", "External (Insp)", or "Internal (Exp)".
3. **Sculpted Diaphragm Dome with Central Tendon & Hiatuses (`SculptedDiaphragmDome`)**:
   - Parametric 32-segment radial dome attached flush to:
     - Anterior: sternal xiphoid process at `[0, 1.04, 1.09]`.
     - Lateral: CT costal margins (ribs 7–12) at $Y = 0.55 \dots 1.15$, $X = \pm 1.30$.
     - Posterior: lumbar spine L1–L3 vertebrae at $Y = 0.03 \dots -0.73$, $Z = -0.22$.
   - Real-time vertex deformation: flattens from $Y = 1.05$ down to $Y = 0.63$ during inspiration, pulling the thoracic cavity open.
   - Glistening trifoliate central tendon with authentic anatomical hiatuses: **Caval opening (T8)**, **Esophageal hiatus (T10)**, and **Aortic hiatus (T12)**.
   - Bilateral lumbar crura with non-garbage-collected matrix scaling.
4. **Scene Camera & Label Realignment**:
   - Repositioned default camera to `[0, 1.45, 6.6]` with `OrbitControls` centered at `[0, 1.45, 0.2]`, framing the thorax, intercostal muscles, lungs, and diaphragm directly at eye level.
   - Updated all 3D floating anatomical labels to match exact CT skeleton and medical lung coordinates.
5. **Verification & Build Protocol**:
   - Executed full unit test suite: all 360 unit tests pass (`npm test`).
   - Cleared port 3000, executed production build with 30s timer protocol (`npm run build`), restarted daemon on port 3000 (`npm run start`), and verified HTTP 200 OK.
