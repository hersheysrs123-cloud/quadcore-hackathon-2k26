# Navigation, capture, timers and alarms

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Sidebar, command palette, instant capture and history (section B), plus the multi-timer HUD and study-break alarms (section D).

### 🔍 B. Universal Navigation, Command Palette, Sidebar & Instant Capture
- **Streamlined Dual-Level Navigation Architecture** (`components/Workspace.jsx` & `components/Sidebar.jsx`):
  - **Top Header (Space-Specific Study Suite)**: Dedicated strictly to the space-filtered views: 📝 **Notes**, 🎯 **Quizzes Studio**, and 📊 **Mastery Dashboard** (with active gap count badge). **Hierarchy breadcrumb** (`data-testid="note-breadcrumb"`): `📁 Space / Parent / Chapter / Sub-Topic` built by `buildBreadcrumbPath`; the space crumb opens the Space Hub, every ancestor crumb is a button that jumps straight to that page (`handleSelectNote`), the current page is `aria-current="page"`. Chains longer than 4 collapse the middle levels into an **`…`** button with a drop-down `role="menu"` of the hidden ancestors (indented by depth); it closes on outside click / `Escape` / navigation.
  - **Sidebar Sub-Page Tree (`buildNoteTree` in `Sidebar.jsx`)**: The notes list is a recursive tree (`renderNoteNode(note, depth)`, 14px indent per level). Notes with children get a ▶ / ▼ chevron (`data-testid="note-tree-toggle"`, `aria-expanded`) that animates the nested `<ul>` via a `grid-rows-[0fr] → [1fr]` transition (`inert` while collapsed). Expansion state lives in `expandedNoteIds` (persisted to `localStorage.socratic_sidebar_expanded_notes`); opening any note auto-expands all of its ancestors (`getAncestorIds`, keyed on the active note so editing never re-expands a parent the user collapsed). Drag-reorder is restricted to one sibling group (`handleReorderNotes` re-indexes only that group); orphans and parent cycles are rendered as top-level so nothing is ever hidden. The Trash drawer labels trashed sub-pages with `↳ in {parent}`.
  - **Hierarchy-safe organisation (`Workspace.jsx` + `lib/noteHierarchy.js`)**: delete (single, bulk, space deletion, card removal) trashes the whole subtree with one `deletedAt` and jumps the view to the nearest surviving ancestor; recover restores the subtree (a root whose parent is no longer live is promoted to top-level; a root whose parent lives in another space follows the parent); permanent delete erases the subtree; **Move to Space** (single or bulk) carries every descendant (`moveNoteTreeToSpace`), the moved note becoming top-level in the destination; **Duplicate** deep-clones the subtree (`cloneNoteTree` re-mints ids and re-points `page` cards); bulk operations act once per topmost selected note (`getTopmostSelected`). Hydration repairs any sub-page that drifted into a different space than its parent.
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

### ⏱️ D. Multi-Timer HUD & Calming Study Break Alerts
- **Zustand Multi-Timer Architecture (`lib/timerStore.js`)**:
  - Centralized reactive state store built with **Zustand** v5 and `persist` middleware.
  - **Auto-Sleep Engine (0% Idle CPU)**: Ticker interval (`setInterval`) is conditionally managed on store mutations. If all timers are paused, idle, or completed, the interval is immediately cleared (`clearInterval`) and nullified, preventing background CPU and battery drain. The 500ms ticker executes strictly when $\ge 1$ timer is actively running.
  - **Storage Key & Legacy Migration**: Persisted under `socratic_multi_timers_v2` with an intelligent storage adapter that seamlessly unpacks both legacy raw JSON arrays and new Zustand persist envelope formats.
  - **Event Dispatching**: Broadcasts window-level `socratic_alarm_triggered` custom events upon timer countdown expiration.
  - **Complete Public API**: Exposes `useGlobalTimer()` React hook (with live computed `secondsLeft`, `percentLeft`, `isNearingEnd`, `customMins`, and dynamic tab title updates) and `multiTimerStore` compatibility object.
- **Unified Global Timer HUD** (`components/GlobalTimerHUD.jsx`): Header dropdown managing concurrent timers: Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom timers with live countdown rings and play/pause controls. Click-outside handling is powered by `usehooks-ts` (`useOnClickOutside`).
- **Standardized Click-Outside Listeners (`usehooks-ts`)**: Standardized across 6 key components (`BlockNoteEditor.jsx`, `CreateQuizModal.jsx`, `GlobalTimerHUD.jsx`, `NoteMenu.jsx`, `Sidebar.jsx`, and `TopicSelectorDropdown.jsx`) replacing duplicated, manual `document.addEventListener("mousedown", ...)` calls.
- **Study Calendar & Schedule** (`components/CalendarView.jsx`): Month navigation, agenda lists, space tagging, 24-hour time pickers, and custom recurring alarm scheduling.
- **Calming Study Break & Timer Alert** (`components/AlarmOverlay.jsx`): Glassmorphic break modal alert (`✨ ☕ 🌱`) with harmonic C-major triad chime synthesis, dynamic browser tab indicator (`🦆` $\leftrightarrow$ `☕`), calming title notices, and friendly snooze/extend buttons.

---
