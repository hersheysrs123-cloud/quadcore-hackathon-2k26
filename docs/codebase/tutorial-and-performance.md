# Onboarding tutorial and runtime performance

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). The interactive tutorial subsystem (K) and performance architecture (L).

### 🎓 K. Interactive Onboarding Tutorial Subsystem (`components/InteractiveTutorial.jsx` & `lib/tutorialData.js`)
- **9 Interactive Chapters Covering 100+ Features**:
  1. `philosophy`: Active Retrieval vs rereading illusion, 100% local-first IndexedDB (Dexie.js v8), and Spaces architecture with interactive concept selector.
  2. `editor`: 19-block Notion-grade studio, 23-item slash menu (`/`), 6-dots handle (`⠿`), KaTeX LaTeX equations, table row/col drag handles, and interactive 3-font typography switcher (`sans`, `serif`, `mono`).
  3. `ai_suite`: Persistent side-by-side study drawers with tabbed preview of the Explain Panel (4-part breakdown) and an **interactive live mini-quiz** with real-time answer checking, feedback, and mastery heatmap explanation.
  4. `quizzes`: Dedicated Quizzes Studio 2-column exam runner, question matrix, draft auto-save, comprehensive review reports, 7 question types, and an **interactive step-ordering puzzle**.
  5. `spacehub`: Space Hub per-space syllabus doc uploads (.pdf, .docx, .txt, .md), active AI toggles, and an **interactive curriculum standard selector** (IGCSE, IB, AP, University) previewing AI personas and distractor strictness in real time.
  6. `visualizations`: 50+ interactive 3D simulations across 5 STEM domains (Physics, Chemistry, Biology, CS, Math) with interactive domain filters, parameter sliders, and OrbitControls.
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
